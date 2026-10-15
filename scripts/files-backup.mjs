// The files kept at Cloudinary (photos, documents, attachments, logos), and
// their copy in a separate bucket. Used by .github/workflows/files-backup.yml
// and restore-test.yml; restore by hand as said under "restore" below.
//
//   node scripts/files-backup.mjs download <existing-keys.txt> <out-dir>
//     Every private file under schools/ whose key is not in existing-keys.txt
//     (one key per line, as in the bucket, without ".gpg") is downloaded into
//     out-dir/<key>. Sizes are checked against Cloudinary's.
//   node scripts/files-backup.mjs sizes <keys.txt>
//     For each key, "key bytes" as Cloudinary has it now ("missing" if gone).
//   node scripts/files-backup.mjs restore <dir>
//     Uploads every decrypted file of dir (laid out as out-dir above) back to
//     Cloudinary under its own public_id; files already there are left alone.
//
// To bring files back: copy them out of the bucket (all, or one school's
// folder), decrypt them, then restore:
//   aws s3 cp s3://<bucket>/files/ ./files --recursive --endpoint-url <R2_ENDPOINT>
//     (add --exclude '*' --include '*/schools/<school id>/*' for one school)
//   find ./files -name '*.gpg' -exec sh -c 'gpg --batch --pinentry-mode loopback \
//     --passphrase-fd 3 --decrypt --output "${1%.gpg}" "$1" && rm "$1"' _ {} \; 3<passphrase.txt
//   node scripts/files-backup.mjs restore ./files
//
// Keys: image/<public_id>.<format> and raw/<public_id> (a raw public_id ends
// with its extension already).
//
// Needs CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, and
// the cloudinary package: npm install --prefix <dir> cloudinary@2, then
// CLOUDINARY_MODULE_DIR=<dir>.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.env.CLOUDINARY_MODULE_DIR || process.cwd(), 'noop.js'));
const { v2: cloudinary } = require('cloudinary');

for (const name of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
  if (!process.env[name]) {
    console.error(`${name} is not set`);
    process.exit(1);
  }
}
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const TYPES = ['image', 'raw'];
const PARALLEL = 5;

const keyOf = (r) => (r.resource_type === 'image' ? `image/${r.public_id}.${r.format}` : `raw/${r.public_id}`);

function fromKey(key) {
  const [type, ...rest] = key.split('/');
  const name = rest.join('/');
  if (type === 'raw') return { resource_type: 'raw', public_id: name };
  const dot = name.lastIndexOf('.');
  return { resource_type: 'image', public_id: name.slice(0, dot), format: name.slice(dot + 1) };
}

/** Every private file the schools have, from Cloudinary's admin API. */
async function* listAll() {
  for (const resource_type of TYPES) {
    let next_cursor;
    do {
      const page = await cloudinary.api.resources({
        type: 'authenticated',
        resource_type,
        prefix: 'schools/',
        max_results: 500,
        next_cursor,
      });
      yield* page.resources;
      next_cursor = page.next_cursor;
    } while (next_cursor);
  }
}

async function inParallel(items, work) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (queue.length) await work(queue.shift());
    }),
  );
}

const readKeys = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];

async function download(existingFile, outDir) {
  const existing = new Set(readKeys(existingFile));
  const wanted = [];
  let total = 0;
  for await (const r of listAll()) {
    total++;
    if (!existing.has(keyOf(r))) wanted.push(r);
  }
  console.log(`${total} files at Cloudinary, ${total - wanted.length} already copied, ${wanted.length} new.`);

  const failed = [];
  let bytes = 0;
  await inParallel(wanted, async (r) => {
    const key = keyOf(r);
    try {
      const url = cloudinary.url(r.public_id, {
        type: 'authenticated',
        resource_type: r.resource_type,
        sign_url: true,
        secure: true,
        version: r.version,
        ...(r.resource_type === 'image' ? { format: r.format } : {}),
      });
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length !== r.bytes) throw new Error(`${body.length} bytes, Cloudinary says ${r.bytes}`);
      const file = path.join(outDir, key);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body);
      bytes += body.length;
    } catch (error) {
      failed.push(`${key}: ${error.message}`);
    }
  });

  console.log(`Downloaded ${wanted.length - failed.length} files, ${(bytes / 1048576).toFixed(1)} MB.`);
  if (failed.length) {
    console.error(`${failed.length} could not be downloaded:\n${failed.join('\n')}`);
    process.exitCode = 2;
  }
}

async function sizes(keysFile) {
  for (const key of readKeys(keysFile)) {
    const { resource_type, public_id } = fromKey(key);
    try {
      const r = await cloudinary.api.resource(public_id, { type: 'authenticated', resource_type });
      console.log(`${key} ${r.bytes}`);
    } catch (error) {
      // Deleted at Cloudinary since: the copy is all there is. Anything else
      // (wrong keys, the API down) is not an answer.
      if (error?.error?.http_code !== 404) throw error;
      console.log(`${key} missing`);
    }
  }
}

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(full) : [full];
  });
}

async function restore(dir) {
  const files = filesUnder(dir).filter((f) => !f.endsWith('.gpg'));
  let done = 0;
  let kept = 0;
  const failed = [];
  await inParallel(files, async (file) => {
    const key = path.relative(dir, file).split(path.sep).join('/');
    const { resource_type, public_id } = fromKey(key);
    try {
      const result = await cloudinary.uploader.upload(file, {
        type: 'authenticated',
        resource_type,
        public_id,
        overwrite: false,
      });
      if (result.existing) kept++;
      else done++;
    } catch (error) {
      failed.push(`${key}: ${error.message ?? error}`);
    }
  });
  console.log(`${done} restored, ${kept} already at Cloudinary (left alone).`);
  if (failed.length) {
    console.error(`${failed.length} failed:\n${failed.join('\n')}`);
    process.exitCode = 2;
  }
}

const [mode, ...args] = process.argv.slice(2);
const modes = { download: [download, 2], sizes: [sizes, 1], restore: [restore, 1] };
if (!modes[mode] || args.length !== modes[mode][1]) {
  console.error('Usage: files-backup.mjs download <existing-keys.txt> <out-dir> | sizes <keys.txt> | restore <dir>');
  process.exit(1);
}
await modes[mode][0](...args);
