/** Receipt/attachment file types we recognise, by extension. */
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export function mimeTypeForExtension(ext: string): string {
  return MIME_BY_EXTENSION[ext.toLowerCase()] ?? 'application/octet-stream';
}

/** The extension at the end of a file name or storage path, if it's a sane one. */
export function extensionOf(name: string): string | null {
  const match = /\.([a-z0-9]{1,5})$/i.exec(name);
  return match ? match[1].toLowerCase() : null;
}

/** Picks an extension for an upload: from its name first, then its MIME type. */
export function extensionForUpload(originalName: string, mimeType: string): string | null {
  return extensionOf(originalName) ?? EXTENSION_BY_MIME[mimeType.toLowerCase()] ?? null;
}

/** Recognises common file types from their first bytes (for files stored without an extension). */
export function sniffExtension(buffer: Buffer): string | null {
  const head = buffer.subarray(0, 12);
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (head.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'webp';
  }
  const brand = head.subarray(4, 12).toString('latin1');
  if (brand === 'ftypheic' || brand === 'ftypheix' || brand === 'ftypmif1') return 'heic';
  return null;
}

/**
 * A Content-Disposition value with an ASCII fallback name plus the exact
 * UTF-8 name (RFC 6266 / 5987), so accented and Arabic names survive.
 */
export function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'file';
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
