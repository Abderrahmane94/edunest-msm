import { Request, Response, NextFunction } from 'express';
import { equipmentService, EquipmentServiceError } from './equipment.service';
import { successResponse, errorResponse } from '../../utils/response';
import type { CreateEquipmentInput, UpdateEquipmentInput } from './equipment.schema';

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof EquipmentServiceError) {
    res.status(error.statusCode).json(errorResponse('EQUIPMENT_ERROR', error.message));
    return;
  }
  next(error);
}

export const equipmentController = {
  /** GET /api/equipment — The school's equipment */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(successResponse(await equipmentService.list(req.user!.schoolId!)));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** GET /api/equipment/summary — How many pieces need repairing */
  async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(successResponse({ toRepair: await equipmentService.toRepairCount(req.user!.schoolId!) }));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** POST /api/equipment — Add equipment */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await equipmentService.create(req.user!.schoolId!, req.body as CreateEquipmentInput);
      res.status(201).json(successResponse(item));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** PUT /api/equipment/:id — Update equipment (room, condition, quantity…) */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await equipmentService.update(req.params.id, req.user!.schoolId!, req.body as UpdateEquipmentInput);
      res.status(200).json(successResponse(item));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** DELETE /api/equipment/:id — Remove equipment */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await equipmentService.delete(req.params.id, req.user!.schoolId!);
      res.status(200).json(successResponse({ message: 'Equipment deleted' }));
    } catch (error) {
      handleError(error, res, next);
    }
  },
};
