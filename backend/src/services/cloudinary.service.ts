import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

const EXPIRY_SECONDS: Record<'photo' | 'document', number> = {
  photo: 60 * 60, // 1 hour
  document: 24 * 60 * 60, // 24 hours
};

function getUploadsSigningSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');
  return secret;
}

/**
 * Signs a local-storage upload path so it can't be accessed just by guessing the filename.
 */
export function signUploadPath(publicId: string, expires: number): string {
  return crypto
    .createHmac('sha256', getUploadsSigningSecret())
    .update(`${publicId}:${expires}`)
    .digest('hex');
}

/**
 * Verifies a signed local-storage upload path. Used by the /uploads static route guard.
 */
export function verifyUploadPath(publicId: string, expires: number, token: string): boolean {
  if (!Number.isFinite(expires) || Date.now() / 1000 > expires) {
    return false;
  }
  const expected = signUploadPath(publicId, expires);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(token, 'hex');
  return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export interface UploadOptions {
  folder: string;
  resourceType: 'image' | 'raw';
  accessMode: 'authenticated';
}

export interface UploadResult {
  publicId: string;
  url: string;
  format: string;
  bytes: number;
}

/** 'photo' -> image resources, 'document' -> raw (PDF, etc.) resources. */
function resourceTypeFor(type: 'photo' | 'document'): 'image' | 'raw' {
  return type === 'document' ? 'raw' : 'image';
}

class CloudinaryService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.CLOUDINARY_API_KEY || '';

    if (this.apiKey && process.env.NODE_ENV === 'production') {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: this.apiKey,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
  }

  private isConfigured(): boolean {
    return !!this.apiKey && process.env.NODE_ENV === 'production';
  }

  /**
   * Upload a file to Cloudinary as a private ("authenticated") resource.
   * In development mode (or when unconfigured), falls back to local disk.
   */
  async uploadFile(file: Buffer, options: UploadOptions): Promise<UploadResult> {
    if (!this.isConfigured()) {
      const ext = options.resourceType === 'image' ? 'jpg' : 'pdf';
      const filename = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const publicId = `${options.folder}/${filename}`;
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', options.folder);
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, filename), file);
      return {
        publicId,
        url: `/uploads/${publicId}`,
        format: ext,
        bytes: file.length,
      };
    }

    // Cloudinary sniffs the real file type from the content itself, so the
    // declared mime type in the data URI doesn't need to be exact.
    const dataUri = `data:application/octet-stream;base64,${file.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: options.folder,
      resource_type: options.resourceType,
      type: 'authenticated',
    });

    return {
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      bytes: result.bytes,
    };
  }

  /**
   * Generate a URL for accessing an authenticated resource.
   * @param publicId - The Cloudinary public_id of the resource
   * @param type - The type of resource (determines expiry: photo=1hr, document=24hr, local-disk fallback only)
   * @param format - The resource's file format/extension. When provided (and Cloudinary is
   *   configured), this uses `private_download_url` to produce a genuinely time-limited link;
   *   without it, falls back to a signed-but-non-expiring delivery URL (proves it was generated
   *   with our api_secret, but Cloudinary's own expiring links otherwise require enabling
   *   token-based authentication in the account dashboard first).
   */
  generateSignedUrl(publicId: string, type: 'photo' | 'document', format?: string): string {
    if (!this.isConfigured()) {
      const expires = Math.floor(Date.now() / 1000) + EXPIRY_SECONDS[type];
      const token = signUploadPath(publicId, expires);
      return `/uploads/${publicId}?expires=${expires}&token=${token}`;
    }

    if (format) {
      return cloudinary.utils.private_download_url(publicId, format, {
        resource_type: resourceTypeFor(type),
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + EXPIRY_SECONDS[type],
      });
    }

    return cloudinary.url(publicId, {
      type: 'authenticated',
      sign_url: true,
      secure: true,
      resource_type: resourceTypeFor(type),
    });
  }

  /**
   * Delete a file from Cloudinary.
   * @param publicId - The Cloudinary public_id of the resource to delete
   */
  async deleteFile(publicId: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    // The stored publicId alone doesn't tell us whether it's an image or a
    // raw document, so try image first and fall back to raw.
    try {
      await cloudinary.uploader.destroy(publicId, { type: 'authenticated', resource_type: 'image' });
    } catch {
      await cloudinary.uploader.destroy(publicId, { type: 'authenticated', resource_type: 'raw' });
    }
  }
}

export const cloudinaryService = new CloudinaryService();
