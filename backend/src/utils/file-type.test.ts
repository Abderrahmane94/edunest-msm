import { describe, it, expect } from 'vitest';
import {
  contentDisposition,
  extensionForUpload,
  extensionOf,
  mimeTypeForExtension,
  sniffExtension,
} from './file-type';

describe('file-type', () => {
  describe('extensionForUpload', () => {
    it('takes the extension from the uploaded file name', () => {
      expect(extensionForUpload('Facture Papeterie.JPG', 'image/jpeg')).toBe('jpg');
      expect(extensionForUpload('reçu.pdf', 'application/octet-stream')).toBe('pdf');
    });

    it('falls back to the MIME type when the name has no extension', () => {
      expect(extensionForUpload('scan', 'image/png')).toBe('png');
      expect(extensionForUpload('blob', 'application/pdf')).toBe('pdf');
    });

    it('returns null when neither tells the type', () => {
      expect(extensionForUpload('scan', 'application/octet-stream')).toBeNull();
    });
  });

  describe('extensionOf', () => {
    it('reads the extension at the end of a storage path', () => {
      expect(extensionOf('schools/s1/expenses/0b6f-4c1e.webp')).toBe('webp');
    });

    it('returns null for extension-less paths', () => {
      expect(extensionOf('schools/s1/expenses/abc123xyz')).toBeNull();
    });
  });

  describe('sniffExtension', () => {
    it('recognises PDFs, JPEGs, PNGs and WebP from their first bytes', () => {
      expect(sniffExtension(Buffer.from('%PDF-1.7\n'))).toBe('pdf');
      expect(sniffExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('jpg');
      expect(sniffExtension(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png');
      expect(sniffExtension(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
    });

    it('returns null for unknown content', () => {
      expect(sniffExtension(Buffer.from('hello world'))).toBeNull();
    });
  });

  it('maps extensions to MIME types', () => {
    expect(mimeTypeForExtension('JPG')).toBe('image/jpeg');
    expect(mimeTypeForExtension('pdf')).toBe('application/pdf');
    expect(mimeTypeForExtension('xyz')).toBe('application/octet-stream');
  });

  it('builds a Content-Disposition that keeps non-ASCII names', () => {
    const header = contentDisposition('inline', '2026-10-03 - Fournitures "été".pdf');

    expect(header).toBe(
      'inline; filename="2026-10-03 - Fournitures ete.pdf"; ' +
        `filename*=UTF-8''${encodeURIComponent('2026-10-03 - Fournitures "été".pdf')}`,
    );
  });
});
