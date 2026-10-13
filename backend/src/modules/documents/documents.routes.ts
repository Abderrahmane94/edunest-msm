import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { can, requirePermission } from '../../middleware/permission.middleware';
import { validate, validateParams } from '../../middleware/validation.middleware';
import { contentDisposition } from '../../utils/file-type';
import { errorResponse, successResponse } from '../../utils/response';
import { idParamSchema } from '../../utils/validators';
import { documentFieldsSchema, documentUpdateSchema, type DocumentFields, type DocumentUpdate } from './documents.schema';
import { documentService, DocumentServiceError, type UploadedFile } from './documents.service';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof DocumentServiceError) {
    res.status(error.statusCode).json(errorResponse(error.statusCode === 409 ? 'CONFLICT' : 'DOCUMENT_ERROR', error.message));
    return;
  }
  next(error);
}

function uploaded(req: Request): UploadedFile | undefined {
  if (!req.file) return undefined;
  return {
    buffer: req.file.buffer,
    // Multer decodes the multipart file name as latin1; browsers send UTF-8.
    originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
    mimeType: req.file.mimetype,
  };
}

// GET /api/documents — The school's documents (office)
router.get('/', requirePermission('documents', 'view'), async (req, res, next) => {
  try {
    res.status(200).json(successResponse(await documentService.list(req.user!.schoolId!)));
  } catch (error) {
    handleError(error, res, next);
  }
});

// GET /api/documents/shared — What the school shows the families (anyone of the school)
router.get('/shared', async (req, res, next) => {
  try {
    res.status(200).json(successResponse(await documentService.listShared(req.user!.schoolId!)));
  } catch (error) {
    handleError(error, res, next);
  }
});

// POST /api/documents — Add a document with its file
router.post('/', requirePermission('documents', 'edit'), upload.single('file'), validate(documentFieldsSchema), async (req, res, next) => {
  try {
    const file = uploaded(req);
    if (!file) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'No file uploaded'));
      return;
    }
    const document = await documentService.create(req.user!.schoolId!, req.user!.userId, req.body as DocumentFields, file);
    res.status(201).json(successResponse(document));
  } catch (error) {
    handleError(error, res, next);
  }
});

// PUT /api/documents/:id — Change its name, category, note, who sees it; replace its file when one is sent
router.put('/:id', requirePermission('documents', 'edit'), validateParams(idParamSchema), upload.single('file'), validate(documentUpdateSchema), async (req, res, next) => {
  try {
    const document = await documentService.update(req.params.id, req.user!.schoolId!, req.body as DocumentUpdate, uploaded(req));
    res.status(200).json(successResponse(document));
  } catch (error) {
    handleError(error, res, next);
  }
});

// DELETE /api/documents/:id — Remove a document and its file
router.delete('/:id', requirePermission('documents', 'edit'), validateParams(idParamSchema), async (req, res, next) => {
  try {
    await documentService.remove(req.params.id, req.user!.schoolId!);
    res.status(200).json(successResponse({ deleted: true }));
  } catch (error) {
    handleError(error, res, next);
  }
});

// GET /api/documents/:id/file — The file: the office with the right, anyone of the school when it is shown to families
router.get('/:id/file', validateParams(idParamSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user!.role;
    const office = (role === 'admin' || role === 'super_admin' || role === 'administrative') && (await can(req, 'documents', 'view'));
    const file = await documentService.getFile(req.params.id, req.user!.schoolId!, !office);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', contentDisposition(file.inline ? 'inline' : 'attachment', file.fileName));
    // The frontend is on another origin and reads the name from this header.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(file.buffer);
  } catch (error) {
    handleError(error, res, next);
  }
});

export default router;
