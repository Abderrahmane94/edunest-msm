import { Router } from 'express';
import { branchFeeService, BranchFeeServiceError } from './branch-fee.service';

const router = Router();

/**
 * GET /api/payments/branches/:branchId/fees
 * List all fees for a branch.
 */
router.get('/branches/:branchId/fees', async (req, res) => {
  try {
    const { branchId } = req.params;
    const onlyActive = req.query.all !== 'true';
    const fees = await branchFeeService.list(branchId, onlyActive);
    res.json({ success: true, data: fees });
  } catch (error) {
    if (error instanceof BranchFeeServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    } else {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  }
});

/**
 * POST /api/payments/branches/:branchId/fees
 * Create a new fee for a branch.
 */
router.post('/branches/:branchId/fees', async (req, res) => {
  try {
    const { branchId } = req.params;
    const { name, amount } = req.body;
    const fee = await branchFeeService.create(branchId, { name, amount: Number(amount) });
    res.status(201).json({ success: true, data: fee });
  } catch (error) {
    if (error instanceof BranchFeeServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    } else {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  }
});

/**
 * PUT /api/payments/branches/:branchId/fees/:id
 * Update a fee.
 */
router.put('/branches/:branchId/fees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, isActive } = req.body;
    const fee = await branchFeeService.update(id, {
      name,
      amount: amount !== undefined ? Number(amount) : undefined,
      isActive,
    });
    res.json({ success: true, data: fee });
  } catch (error) {
    if (error instanceof BranchFeeServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    } else {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  }
});

/**
 * DELETE /api/payments/branches/:branchId/fees/:id
 * Deactivate a fee (soft delete).
 */
router.delete('/branches/:branchId/fees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await branchFeeService.deactivate(id);
    res.json({ success: true, data: { message: 'Fee deactivated' } });
  } catch (error) {
    if (error instanceof BranchFeeServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    } else {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  }
});

/**
 * POST /api/payments/enrollments/:enrollmentId/apply-fee
 * Apply a fee to an enrollment (creates a billing period).
 */
router.post('/enrollments/:enrollmentId/apply-fee', async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { branchFeeId } = req.body;

    if (!branchFeeId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'branchFeeId is required' },
      });
      return;
    }

    const result = await branchFeeService.applyFeeToEnrollment(branchFeeId, enrollmentId);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof BranchFeeServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    } else {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  }
});

/**
 * POST /api/payments/branches/:branchId/fees/:id/assign
 * Batch-assign a fee to children/classrooms/school.
 * Body: { target: 'children' | 'classrooms' | 'school', childIds?: string[], classroomIds?: string[] }
 */
router.post('/branches/:branchId/fees/:id/assign', async (req, res) => {
  try {
    const { branchId, id } = req.params;
    const { target, childIds, classroomIds } = req.body;

    if (!target || !['children', 'classrooms', 'school'].includes(target)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'target must be one of: children, classrooms, school' },
      });
      return;
    }

    if (target === 'children' && (!childIds || !Array.isArray(childIds) || childIds.length === 0)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'childIds array is required for target "children"' },
      });
      return;
    }

    if (target === 'classrooms' && (!classroomIds || !Array.isArray(classroomIds) || classroomIds.length === 0)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'classroomIds array is required for target "classrooms"' },
      });
      return;
    }

    const result = await branchFeeService.applyFeeBatch(id, branchId, {
      type: target,
      childIds,
      classroomIds,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof BranchFeeServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    } else {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  }
});

export default router;
