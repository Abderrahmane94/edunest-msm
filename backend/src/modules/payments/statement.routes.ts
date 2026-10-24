import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { can, NOT_ALLOWED_MESSAGE } from '../../middleware/permission.middleware';
import { validateParams } from '../../middleware/validation.middleware';
import { emailService } from '../../services/email.service';
import { errorResponse, successResponse } from '../../utils/response';
import { academicYearQuery, uuidSchema } from '../../utils/validators';
import { statementService, StatementServiceError } from './statement.service';

const router = Router();

const childParamSchema = z.object({ childId: uuidSchema });

const emailSchema = z.object({
  to: z.string().trim().email().optional().or(z.literal('')),
  language: z.enum(['ar', 'fr']).default('fr'),
  family: z.boolean().default(false),
  academicYearId: uuidSchema.optional(),
  // The statement rendered by the browser, base64 (~3 MB max once decoded).
  pdfBase64: z.string().max(4_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  pdfFileName: z.string().max(150).optional(),
});

/**
 * Who may read a child's statement: the office with a right on the
 * collections, the fees or the children; a parent, for their own child.
 * Answers the refusal itself and returns null.
 */
async function reader(req: Request, res: Response): Promise<'office' | 'parent' | null> {
  const role = req.user!.role;
  if (role === 'parent') {
    if (await statementService.isParentOf(req.user!.userId, req.params.childId)) return 'parent';
  } else if (role === 'admin' || role === 'super_admin' || role === 'administrative') {
    if ((await can(req, 'collections', 'view')) || (await can(req, 'fees', 'view')) || (await can(req, 'children', 'view'))) return 'office';
  }
  res.status(403).json(errorResponse('FORBIDDEN', NOT_ALLOWED_MESSAGE));
  return null;
}

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof StatementServiceError) {
    res.status(error.statusCode).json(errorResponse('STATEMENT_ERROR', error.message));
    return;
  }
  next(error);
}

// GET /api/payments/children/:childId/statement?academic_year_id=&family=true — The statement of account of a child
router.get('/children/:childId/statement', validateParams(childParamSchema), async (req, res, next) => {
  try {
    if (!(await reader(req, res))) return;
    const document = await statementService.document(req.user!.schoolId!, req.params.childId, {
      academicYearId: academicYearQuery(req.query),
      family: req.query.family === 'true',
    });
    res.status(200).json(successResponse(document));
  } catch (error) {
    handleError(error, res, next);
  }
});

// POST /api/payments/children/:childId/statement/email — Send it (office: any address, the first parent's by default; a parent: their own)
router.post('/children/:childId/statement/email', validateParams(childParamSchema), async (req, res, next) => {
  try {
    const who = await reader(req, res);
    if (!who) return;
    const parsed = emailSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Request body validation failed', parsed.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message }))));
      return;
    }
    const input = parsed.data;
    if (!Buffer.from(input.pdfBase64.slice(0, 16), 'base64').toString('latin1').startsWith('%PDF-')) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'The attachment is not a PDF'));
      return;
    }

    const own = who === 'parent' ? (await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { email: true } }))?.email : null;
    const recipient = who === 'parent' ? own : input.to || (await statementService.defaultRecipient(req.params.childId));
    if (!recipient) {
      res.status(400).json(errorResponse('NO_RECIPIENT', 'No email address to send the statement to'));
      return;
    }

    // What the message says comes from the server's own figures, not from the page.
    const document = await statementService.document(req.user!.schoolId!, req.params.childId, { academicYearId: input.academicYearId, family: input.family });
    // Control characters are stripped on purpose.
    // eslint-disable-next-line no-control-regex
    const base = (input.pdfFileName || 'releve').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim() || 'releve';
    try {
      await emailService.sendStatementEmail(recipient, document, input.language, { filename: `${base}.pdf`, content: input.pdfBase64 });
    } catch (err) {
      res.status(502).json(errorResponse('EMAIL_FAILED', err instanceof Error ? err.message : 'Failed to send email'));
      return;
    }
    res.status(200).json(successResponse({ sentTo: recipient }));
  } catch (error) {
    handleError(error, res, next);
  }
});

export default router;
