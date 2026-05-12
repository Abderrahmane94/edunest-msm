import { Request, Response, NextFunction } from 'express';
import { academicYearsService, AcademicYearServiceError } from './academic-years.service';
import { successResponse, paginatedResponse, errorResponse } from '../../utils/response';
import type { CreateAcademicYearInput, UpdateAcademicYearInput } from './academic-years.schema';
import { paginationSchema } from '../../utils/validators';

export const academicYearsController = {
  /**
   * POST /api/academic-years — Create a new academic year
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const input = req.body as CreateAcademicYearInput;
      const academicYear = await academicYearsService.create(schoolId, input);
      res.status(201).json(successResponse(academicYear));
    } catch (error) {
      if (error instanceof AcademicYearServiceError) {
        res.status(error.statusCode).json(errorResponse('ACADEMIC_YEAR_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/academic-years — List academic years for the school
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { academicYears, total } = await academicYearsService.list(schoolId, page, pageSize);
      res.status(200).json(paginatedResponse(academicYears, page, pageSize, total));
    } catch (error) {
      if (error instanceof AcademicYearServiceError) {
        res.status(error.statusCode).json(errorResponse('ACADEMIC_YEAR_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * GET /api/academic-years/:id — Get academic year by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const academicYear = await academicYearsService.getById(id, schoolId);
      res.status(200).json(successResponse(academicYear));
    } catch (error) {
      if (error instanceof AcademicYearServiceError) {
        res.status(error.statusCode).json(errorResponse('ACADEMIC_YEAR_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/academic-years/:id — Update an academic year
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const input = req.body as UpdateAcademicYearInput;
      const academicYear = await academicYearsService.update(id, schoolId, input);
      res.status(200).json(successResponse(academicYear));
    } catch (error) {
      if (error instanceof AcademicYearServiceError) {
        res.status(error.statusCode).json(errorResponse('ACADEMIC_YEAR_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/academic-years/:id — Delete an academic year (inactive only)
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      await academicYearsService.delete(id, schoolId);
      res.status(200).json(successResponse({ message: 'Academic year deleted successfully' }));
    } catch (error) {
      if (error instanceof AcademicYearServiceError) {
        res.status(error.statusCode).json(errorResponse('ACADEMIC_YEAR_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/academic-years/:id/activate — Activate an academic year
   */
  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const academicYear = await academicYearsService.activate(id, schoolId);
      res.status(200).json(successResponse(academicYear));
    } catch (error) {
      if (error instanceof AcademicYearServiceError) {
        res.status(error.statusCode).json(errorResponse('ACADEMIC_YEAR_ERROR', error.message));
        return;
      }
      next(error);
    }
  },

  /**
   * PATCH /api/academic-years/:id/deactivate — Deactivate an academic year
   */
  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schoolId = req.user!.schoolId;
      const { id } = req.params;
      const academicYear = await academicYearsService.deactivate(id, schoolId);
      res.status(200).json(successResponse(academicYear));
    } catch (error) {
      if (error instanceof AcademicYearServiceError) {
        res.status(error.statusCode).json(errorResponse('ACADEMIC_YEAR_ERROR', error.message));
        return;
      }
      next(error);
    }
  },
};
