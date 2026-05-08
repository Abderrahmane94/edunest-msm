import { Request, Response, NextFunction } from 'express';
import { childrenService, ChildServiceError } from './children.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import type { CreateChildInput, UpdateChildInput, EnrollChildInput, CreateParentLinkInput, CreateEmergencyContactInput, UpdateEmergencyContactInput } from './children.schema';
import { paginationSchema } from '../../utils/validators';

export const childrenController = {
  /**
   * POST /api/children — Register a new child
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const input = req.body as CreateChildInput;
      const child = await childrenService.create(schoolId, input);
      res.status(201).json(successResponse(child));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/children — List children in school
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { children, total } = await childrenService.list(schoolId, page, pageSize);
      res.status(200).json(paginatedResponse(children, page, pageSize, total));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/children/:id — Get child by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const child = await childrenService.getById(id, schoolId);
      res.status(200).json(successResponse(child));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/children/:id — Update child
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const input = req.body as UpdateChildInput;
      const child = await childrenService.update(id, schoolId, input);
      res.status(200).json(successResponse(child));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/children/:id — Soft delete child (set is_active = false)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      await childrenService.softDelete(id, schoolId);
      res.status(200).json(successResponse({ message: 'Child deactivated successfully' }));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/children/:id/enroll — Enroll child in a classroom
   */
  async enroll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const input = req.body as EnrollChildInput;
      const enrollment = await childrenService.enrollInClassroom(id, schoolId, input);
      res.status(201).json(successResponse(enrollment));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/children/:id/photo — Upload child photo
   */
  async uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;

      if (!req.body || !Buffer.isBuffer(req.body)) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'Photo file is required. Send raw image data in the request body.'));
        return;
      }

      const child = await childrenService.uploadPhoto(id, schoolId, req.body);
      res.status(200).json(successResponse(child));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/children/:id/photo-url — Get signed photo URL (1hr expiry)
   */
  async getPhotoUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const photoUrl = await childrenService.getPhotoUrl(id, schoolId);
      res.status(200).json(successResponse(photoUrl));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * POST /api/children/:id/parent-links — Create a parent-child link
   */
  async createParentLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const input = req.body as CreateParentLinkInput;
      const link = await childrenService.createParentLink(id, schoolId, input);
      res.status(201).json(successResponse(link));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/children/:id/parent-links — List parent links for a child
   */
  async getParentLinks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const links = await childrenService.getParentLinks(id, schoolId);
      res.status(200).json(successResponse(links));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/children/:id/parent-links/:linkId — Remove a parent-child link
   */
  async removeParentLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id, linkId } = req.params;
      await childrenService.removeParentLink(id, schoolId, linkId);
      res.status(200).json(successResponse({ message: 'Parent-child link removed successfully' }));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/children/:id/parent-links/:linkId/primary — Set link as primary
   */
  async setPrimaryLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id, linkId } = req.params;
      const link = await childrenService.setPrimaryLink(id, schoolId, linkId);
      res.status(200).json(successResponse(link));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  // ─── Emergency Contacts ──────────────────────────────────────────────────────

  /**
   * POST /api/children/:id/emergency-contacts — Add emergency contact
   */
  async addEmergencyContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const input = req.body as CreateEmergencyContactInput;
      const contact = await childrenService.addEmergencyContact(id, schoolId, input);
      res.status(201).json(successResponse(contact));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/children/:id/emergency-contacts — List emergency contacts for a child
   */
  async getEmergencyContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const contacts = await childrenService.getEmergencyContacts(id, schoolId);
      res.status(200).json(successResponse(contacts));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/children/:id/emergency-contacts/:contactId — Update emergency contact
   */
  async updateEmergencyContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id, contactId } = req.params;
      const input = req.body as UpdateEmergencyContactInput;
      const contact = await childrenService.updateEmergencyContact(id, schoolId, contactId, input);
      res.status(200).json(successResponse(contact));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/children/:id/emergency-contacts/:contactId — Delete emergency contact
   */
  async removeEmergencyContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id, contactId } = req.params;
      await childrenService.removeEmergencyContact(id, schoolId, contactId);
      res.status(200).json(successResponse({ message: 'Emergency contact removed successfully' }));
    } catch (error) {
      if (error instanceof ChildServiceError) {
        res.status(error.statusCode).json(errorResponse('CHILD_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
