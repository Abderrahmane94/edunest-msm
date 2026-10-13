import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  schoolDocument: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
const storage = vi.hoisted(() => ({ uploadFile: vi.fn(), deleteFile: vi.fn(), downloadFile: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: db }));
vi.mock('../../services/cloudinary.service', () => ({ cloudinaryService: storage }));

import { documentService } from './documents.service';
import { documentFieldsSchema } from './documents.schema';

const pdf = (name = 'Dossier.pdf') => ({ buffer: Buffer.from('%PDF-1.7 ...'), originalName: name, mimeType: 'application/pdf' });
const fields = { name: "Dossier d'inscription", category: 'enrollment' as const, visibleToParents: false };

describe('the school documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.schoolDocument.findFirst.mockResolvedValue(null);
    db.schoolDocument.create.mockImplementation(async ({ data }) => ({ id: 'd1', ...data }));
    db.schoolDocument.update.mockImplementation(async ({ data }) => ({ id: 'd1', ...data }));
    storage.uploadFile.mockResolvedValue({ publicId: 'schools/s1/documents/x.pdf', url: '', format: 'pdf', bytes: 12 });
    storage.deleteFile.mockResolvedValue(undefined);
  });

  it('keeps a PDF in the school folder', async () => {
    const made = await documentService.create('s1', 'u1', fields, pdf());
    expect(storage.uploadFile).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({ folder: 'schools/s1/documents', extension: 'pdf' }));
    expect(made).toMatchObject({ schoolId: 's1', fileExtension: 'pdf', visibleToParents: false, createdByUserId: 'u1' });
  });

  it('refuses a program, and a program renamed as a PDF', async () => {
    await expect(documentService.create('s1', 'u1', fields, { ...pdf('virus.exe') })).rejects.toThrow(/not accepted/);
    await expect(documentService.create('s1', 'u1', fields, { buffer: Buffer.from('MZ\x90\x00binary'), originalName: 'dossier.pdf', mimeType: 'application/pdf' })).rejects.toThrow(/not accepted/);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('takes Word files, old and new', async () => {
    await documentService.create('s1', 'u1', fields, { buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), originalName: 'Règlement.docx', mimeType: '' });
    await documentService.create('s1', 'u1', fields, { buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), originalName: 'Fiche.doc', mimeType: '' });
    expect(storage.uploadFile).toHaveBeenCalledTimes(2);
  });

  it('refuses two documents of the same name', async () => {
    db.schoolDocument.findFirst.mockResolvedValue({ id: 'other' });
    await expect(documentService.create('s1', 'u1', fields, pdf())).rejects.toMatchObject({ statusCode: 409 });
  });

  it('removes the old file when a new one replaces it, and only then', async () => {
    db.schoolDocument.findFirst.mockImplementation(async ({ where }) => (where.id === 'd1' ? { id: 'd1', filePublicId: 'old.pdf', name: 'Dossier' } : null));
    await documentService.update('d1', 's1', { note: 'Version 2026' });
    expect(storage.deleteFile).not.toHaveBeenCalled();
    await documentService.update('d1', 's1', {}, pdf());
    expect(storage.deleteFile).toHaveBeenCalledWith('old.pdf');
  });

  it('gives a family only what the school shows them', async () => {
    await expect(documentService.getFile('d1', 's1', true)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.schoolDocument.findFirst).toHaveBeenCalledWith({ where: { id: 'd1', schoolId: 's1', visibleToParents: true } });
    db.schoolDocument.findFirst.mockResolvedValue({ id: 'd1', name: 'Règlement : crèche', filePublicId: 'p.pdf', fileExtension: 'pdf' });
    storage.downloadFile.mockResolvedValue(Buffer.from('%PDF-'));
    const file = await documentService.getFile('d1', 's1', false);
    expect(file).toMatchObject({ fileName: 'Règlement - crèche.pdf', mimeType: 'application/pdf', inline: true });
  });

  it('reads what a form sends beside the file', () => {
    expect(documentFieldsSchema.parse({ name: ' Fiche sanitaire ', category: 'health', visibleToParents: 'true', note: '' })).toEqual({ name: 'Fiche sanitaire', category: 'health', visibleToParents: true, note: null });
    expect(documentFieldsSchema.safeParse({ name: 'A', category: 'health' }).success).toBe(false);
    expect(documentFieldsSchema.safeParse({ name: 'Fiche', category: 'games' }).success).toBe(false);
  });
});
