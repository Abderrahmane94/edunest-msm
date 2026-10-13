import { Router, type NextFunction, type Request, type Response } from 'express';
import { requirePermission, requireAnyPermission } from '../../middleware/permission.middleware';
import { branchFeeService, BranchFeeServiceError } from './branch-fee.service';
import { rejectClosedYear, yearOf } from '../../middleware/closed-year.middleware';
import { validateBranchAccess, validateBranchFeeAccess, validateEnrollmentAccess } from './tenant-scope.middleware';

const router = Router();

type Guard = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const NOT_OF_BRANCH = { success: false, error: { code: 'NOT_FOUND', message: 'Fee not found' } };

/** The branch in the path is one of the user's school (the refusal is answered by the check). */
const ownBranch: Guard = async (req, res, next) => {
  try {
    if (await validateBranchAccess(req.params.branchId, req, res)) next();
  } catch (error) {
    next(error);
  }
};

/** The fee in the path is one of the user's school, and of the branch in the path. */
const ownFee: Guard = async (req, res, next) => {
  try {
    const branchId = await validateBranchFeeAccess(req.params.id, req, res);
    if (!branchId) return;
    if (branchId !== req.params.branchId) {
      res.status(404).json(NOT_OF_BRANCH);
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

/** The enrollment in the path, and the fee in the body when there is one, are of the user's school. */
const ownEnrollmentAndFee: Guard = async (req, res, next) => {
  try {
    if (!(await validateEnrollmentAccess(req.params.enrollmentId, req, res))) return;
    const feeId = (req.body as { branchFeeId?: unknown } | undefined)?.branchFeeId;
    if (typeof feeId === 'string' && feeId && !(await validateBranchFeeAccess(feeId, req, res))) return;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/branches/:branchId/fees
 * List all fees for a branch.
 */
router.get('/branches/:branchId/fees', requireAnyPermission([['fees', 'view'], ['children', 'view'], ['collections', 'view'], ['classes', 'view']]), ownBranch, async (req, res) => {
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
router.post('/branches/:branchId/fees', requirePermission('fees', 'edit'), ownBranch, async (req, res) => {
  try {
    const { branchId } = req.params;
    const { name, amount, showInWizard, billingCycle, billingDueDay, gracePeriodDays } = req.body;
    const fee = await branchFeeService.create(branchId, {
      name,
      amount: Number(amount),
      showInWizard: typeof showInWizard === 'boolean' ? showInWizard : undefined,
      billingCycle: billingCycle ?? null,
      billingDueDay: billingDueDay !== undefined && billingDueDay !== null ? Number(billingDueDay) : null,
      gracePeriodDays: gracePeriodDays !== undefined && gracePeriodDays !== null ? Number(gracePeriodDays) : null,
    });
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
router.put('/branches/:branchId/fees/:id', requirePermission('fees', 'edit'), ownFee, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, isActive, appliesToSchool, showInWizard, billingCycle, billingDueDay, gracePeriodDays } =
      req.body;
    const fee = await branchFeeService.update(id, {
      name,
      amount: amount !== undefined ? Number(amount) : undefined,
      isActive,
      appliesToSchool: typeof appliesToSchool === 'boolean' ? appliesToSchool : undefined,
      showInWizard: typeof showInWizard === 'boolean' ? showInWizard : undefined,
      billingCycle,
      billingDueDay: billingDueDay !== undefined && billingDueDay !== null ? Number(billingDueDay) : billingDueDay,
      gracePeriodDays:
        gracePeriodDays !== undefined && gracePeriodDays !== null ? Number(gracePeriodDays) : gracePeriodDays,
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
router.delete('/branches/:branchId/fees/:id', requirePermission('fees', 'edit'), ownFee, async (req, res) => {
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
router.post('/enrollments/:enrollmentId/apply-fee', requirePermission('fees', 'edit'), rejectClosedYear((req) => yearOf.enrollment(req.params.enrollmentId)), ownEnrollmentAndFee, async (req, res) => {
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
router.post('/branches/:branchId/fees/:id/assign', requirePermission('fees', 'edit'), ownFee, async (req, res) => {
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
