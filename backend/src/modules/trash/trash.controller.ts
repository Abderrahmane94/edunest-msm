import { Request, Response, NextFunction } from 'express';
import { softDeleteService, SoftDeleteError, SoftDeletableModel } from '../../services/soft-delete.service';
import { trashQuerySchema } from './trash.schema';
import { successResponse, errorResponse } from '../../utils/response';

/**
 * Maps plural entity type from URL params to the Prisma model name.
 */
const ENTITY_TYPE_TO_MODEL: Record<string, SoftDeletableModel> = {
  schools: 'school',
  users: 'user',
  children: 'child',
  classrooms: 'classroom',
};

/**
 * Display fields per entity type for trash listing responses.
 */
const DISPLAY_FIELDS: Record<string, string[]> = {
  school: ['name', 'contactEmail', 'wilaya'],
  user: ['firstName', 'lastName', 'email', 'role'],
  child: ['firstName', 'lastName', 'dateOfBirth', 'learnerType'],
  classroom: ['name', 'level', 'roomNumber'],
};

/**
 * Maps SoftDeleteError messages to specific error codes.
 */
function getErrorCode(error: SoftDeleteError): string {
  const message = error.message.toLowerCase();

  if (message.includes('already deleted')) {
    return 'ALREADY_DELETED';
  }
  if (message.includes('is not deleted') || message.includes('only deleted records')) {
    return 'NOT_DELETED';
  }
  if (message.includes('referential integrity')) {
    return 'REFERENTIAL_INTEGRITY';
  }
  if (message.includes('not found')) {
    return 'NOT_FOUND';
  }

  return 'SOFT_DELETE_ERROR';
}

/**
 * Picks only the display-relevant fields from a record.
 */
function pickDisplayFields(record: Record<string, unknown>, model: SoftDeletableModel): Record<string, unknown> {
  const fields = DISPLAY_FIELDS[model] || [];
  const result: Record<string, unknown> = {
    id: record.id,
    deletedAt: record.deletedAt,
  };

  for (const field of fields) {
    if (field in record) {
      result[field] = record[field];
    }
  }

  return result;
}

export const trashController = {
  /**
   * GET /api/trash/:entityType — List soft-deleted records
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.role === 'super_admin' ? '' : req.user!.schoolId!;
      const model = ENTITY_TYPE_TO_MODEL[req.params.entityType];
      const { page, pageSize } = trashQuerySchema.parse(req.query);

      const { data, total } = await softDeleteService.listDeleted(model, schoolId, page, pageSize);

      const items = (data as Record<string, unknown>[]).map((record) =>
        pickDisplayFields(record, model),
      );

      res.status(200).json(successResponse({ items, total, page, pageSize }));
    } catch (error) {
      if (error instanceof SoftDeleteError) {
        res.status(error.statusCode).json(errorResponse(getErrorCode(error), error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/trash/:entityType/:id/restore — Restore a soft-deleted record
   */
  async restore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.role === 'super_admin' ? undefined : req.user!.schoolId!;
      const model = ENTITY_TYPE_TO_MODEL[req.params.entityType];
      const { id } = req.params;

      const restoredEntity = await softDeleteService.restore(model, id, schoolId);

      res.status(200).json(successResponse(restoredEntity));
    } catch (error) {
      if (error instanceof SoftDeleteError) {
        res.status(error.statusCode).json(errorResponse(getErrorCode(error), error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/trash/:entityType/:id — Permanently delete a soft-deleted record
   */
  async hardDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.role === 'super_admin' ? undefined : req.user!.schoolId!;
      const model = ENTITY_TYPE_TO_MODEL[req.params.entityType];
      const { id } = req.params;

      await softDeleteService.hardDelete(model, id, schoolId);

      res.status(200).json(successResponse({ message: 'Record permanently deleted' }));
    } catch (error) {
      if (error instanceof SoftDeleteError) {
        res.status(error.statusCode).json(errorResponse(getErrorCode(error), error.message));
        return;
      }
      next(error);
    }
  },
};
