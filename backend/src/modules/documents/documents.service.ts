import prisma from '../../lib/prisma';
import { cloudinaryService } from '../../services/cloudinary.service';
import { extensionOf, mimeTypeForExtension } from '../../utils/file-type';
import type { DocumentFields, DocumentUpdate } from './documents.schema';

export class DocumentServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'DocumentServiceError';
  }
}

export interface UploadedFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

/** What the library takes: what a school prints or sends, nothing that runs. */
export const DOCUMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'odt'] as const;

/** What the first bytes of each kind of file look like: a renamed file is refused. */
function contentMatches(extension: string, buffer: Buffer): boolean {
  const head = buffer.subarray(0, 12);
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  switch (extension) {
    case 'pdf':
      return head.subarray(0, 5).toString('latin1') === '%PDF-';
    case 'jpg':
    case 'jpeg':
      return starts(0xff, 0xd8, 0xff);
    case 'png':
      return starts(0x89, 0x50, 0x4e, 0x47);
    case 'webp':
      return head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
    // Word, Excel and OpenDocument files of today are zip archives; the older ones are OLE files.
    case 'docx':
    case 'xlsx':
    case 'odt':
      return starts(0x50, 0x4b, 0x03, 0x04);
    case 'doc':
    case 'xls':
      return starts(0xd0, 0xcf, 0x11, 0xe0);
    default:
      return false;
  }
}

function checkedExtension(file: UploadedFile): string {
  const extension = extensionOf(file.originalName);
  if (!extension || !(DOCUMENT_EXTENSIONS as readonly string[]).includes(extension) || !contentMatches(extension, file.buffer)) {
    throw new DocumentServiceError('This kind of file is not accepted in the documents', 400);
  }
  return extension === 'jpeg' ? 'jpg' : extension;
}

const select = {
  id: true,
  name: true,
  category: true,
  note: true,
  fileExtension: true,
  fileSize: true,
  visibleToParents: true,
  createdAt: true,
  updatedAt: true,
} as const;

class DocumentService {
  /** The school's documents, by category then name. */
  list(schoolId: string) {
    return prisma.schoolDocument.findMany({ where: { schoolId }, orderBy: [{ category: 'asc' }, { name: 'asc' }], select });
  }

  /** What the school chose to show the families. */
  listShared(schoolId: string) {
    return prisma.schoolDocument.findMany({ where: { schoolId, visibleToParents: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }], select });
  }

  private async store(schoolId: string, file: UploadedFile) {
    const extension = checkedExtension(file);
    const stored = await cloudinaryService.uploadFile(file.buffer, {
      folder: `schools/${schoolId}/documents`,
      resourceType: 'raw',
      accessMode: 'authenticated',
      extension,
      mimeType: file.mimeType,
    });
    return { filePublicId: stored.publicId, fileExtension: extension, fileSize: file.buffer.length };
  }

  private async assertNameFree(schoolId: string, name: string, exceptId?: string): Promise<void> {
    const same = await prisma.schoolDocument.findFirst({
      where: { schoolId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (same) throw new DocumentServiceError('A document with this name already exists', 409);
  }

  async create(schoolId: string, userId: string, fields: DocumentFields, file: UploadedFile) {
    await this.assertNameFree(schoolId, fields.name);
    const stored = await this.store(schoolId, file);
    return prisma.schoolDocument.create({
      data: { schoolId, createdByUserId: userId, name: fields.name, category: fields.category, note: fields.note ?? null, visibleToParents: fields.visibleToParents, ...stored },
      select,
    });
  }

  /** Changes what is said about the document and, when a file comes with it, the file itself. */
  async update(id: string, schoolId: string, fields: DocumentUpdate, file?: UploadedFile) {
    const document = await prisma.schoolDocument.findFirst({ where: { id, schoolId } });
    if (!document) throw new DocumentServiceError('Document not found', 404);
    if (fields.name !== undefined) await this.assertNameFree(schoolId, fields.name, id);

    const stored = file ? await this.store(schoolId, file) : null;
    const updated = await prisma.schoolDocument.update({
      where: { id },
      data: {
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.category !== undefined && { category: fields.category }),
        ...(fields.note !== undefined && { note: fields.note }),
        ...(fields.visibleToParents !== undefined && { visibleToParents: fields.visibleToParents }),
        ...(stored ?? {}),
      },
      select,
    });
    // The file it replaces is of no use any more; a failure to remove it changes nothing for the school.
    if (stored) await cloudinaryService.deleteFile(document.filePublicId).catch(() => undefined);
    return updated;
  }

  async remove(id: string, schoolId: string): Promise<void> {
    const document = await prisma.schoolDocument.findFirst({ where: { id, schoolId } });
    if (!document) throw new DocumentServiceError('Document not found', 404);
    await prisma.schoolDocument.delete({ where: { id } });
    await cloudinaryService.deleteFile(document.filePublicId).catch(() => undefined);
  }

  /** The file, with its type and a name a person can read. `sharedOnly`: for who has no right on the library. */
  async getFile(id: string, schoolId: string, sharedOnly: boolean): Promise<{ buffer: Buffer; fileName: string; mimeType: string; inline: boolean }> {
    const document = await prisma.schoolDocument.findFirst({ where: { id, schoolId, ...(sharedOnly ? { visibleToParents: true } : {}) } });
    if (!document) throw new DocumentServiceError('Document not found', 404);
    const buffer = await cloudinaryService.downloadFile(document.filePublicId, 'document');
    const name = document.name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100);
    const extension = document.fileExtension;
    return {
      buffer,
      fileName: `${name}.${extension}`,
      mimeType: mimeTypeForExtension(extension),
      // A browser shows PDFs and pictures itself; the rest is saved.
      inline: ['pdf', 'jpg', 'png', 'webp'].includes(extension),
    };
  }
}

export const documentService = new DocumentService();
