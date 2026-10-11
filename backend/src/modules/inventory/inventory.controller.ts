import { Request, Response, NextFunction } from 'express';
import { inventoryService, InventoryServiceError } from './inventory.service';
import { successResponse, errorResponse } from '../../utils/response';
import type { CreateStockItemInput, CreateStockMovementInput, UpdateStockItemInput } from './inventory.schema';

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof InventoryServiceError) {
    res.status(error.statusCode).json(errorResponse('INVENTORY_ERROR', error.message));
    return;
  }
  next(error);
}

export const inventoryController = {
  /** GET /api/inventory/items — The school's supplies */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(successResponse(await inventoryService.list(req.user!.schoolId!)));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** GET /api/inventory/summary — How many supplies are to buy again */
  async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(successResponse({ lowCount: await inventoryService.lowCount(req.user!.schoolId!) }));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** POST /api/inventory/items — Add a supply */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await inventoryService.create(req.user!.schoolId!, req.body as CreateStockItemInput, req.user!.userId);
      res.status(201).json(successResponse(item));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** PUT /api/inventory/items/:id — Update or put aside a supply */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await inventoryService.update(req.params.id, req.user!.schoolId!, req.body as UpdateStockItemInput);
      res.status(200).json(successResponse(item));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** DELETE /api/inventory/items/:id — Delete a supply never moved */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await inventoryService.delete(req.params.id, req.user!.schoolId!);
      res.status(200).json(successResponse({ message: 'Supply deleted' }));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** GET /api/inventory/items/:id/movements — A supply's history */
  async movements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(successResponse(await inventoryService.movements(req.params.id, req.user!.schoolId!)));
    } catch (error) {
      handleError(error, res, next);
    }
  },

  /** POST /api/inventory/items/:id/movements — Record a purchase, a use or a count */
  async recordMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await inventoryService.recordMovement(
        req.params.id,
        req.user!.schoolId!,
        req.user!.userId,
        req.user!.role,
        req.body as CreateStockMovementInput,
      );
      res.status(201).json(successResponse(result));
    } catch (error) {
      handleError(error, res, next);
    }
  },
};
