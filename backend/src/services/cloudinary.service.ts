import fs from 'fs';
import path from 'path';

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

class CloudinaryService {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'demo';
    this.apiKey = process.env.CLOUDINARY_API_KEY || '';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || '';
    // Ensure apiSecret is available for production HMAC signing
    void this.apiSecret;
  }

  /**
   * Upload a file to Cloudinary.
   * In development mode, returns a mock public_id.
   */
  async uploadFile(file: Buffer, options: UploadOptions): Promise<UploadResult> {
    if (!this.apiKey || process.env.NODE_ENV !== 'production') {
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

    // Production implementation would use the Cloudinary SDK
    throw new Error('Cloudinary production upload not yet implemented');
  }

  /**
   * Generate a signed URL for accessing an authenticated resource.
   * @param publicId - The Cloudinary public_id of the resource
   * @param type - The type of resource (determines expiry: photo=1hr, document=24hr)
   */
  generateSignedUrl(publicId: string, _type: 'photo' | 'document'): string {
    if (!this.apiKey || process.env.NODE_ENV !== 'production') {
      return `/uploads/${publicId}`;
    }

    // Production implementation would use Cloudinary SDK for signed URLs
    throw new Error('Cloudinary production signed URL generation not yet implemented');
  }

  /**
   * Delete a file from Cloudinary.
   * @param publicId - The Cloudinary public_id of the resource to delete
   */
  async deleteFile(_publicId: string): Promise<void> {
    // In development/test, no-op
    if (!this.apiKey || process.env.NODE_ENV !== 'production') {
      return;
    }

    // Production implementation would use Cloudinary SDK
    // const cloudinary = require('cloudinary').v2;
    // await cloudinary.uploader.destroy(publicId);
    throw new Error('Cloudinary production delete not yet implemented');
  }
}

export const cloudinaryService = new CloudinaryService();
