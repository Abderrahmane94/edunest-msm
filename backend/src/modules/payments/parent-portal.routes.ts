import { Router } from 'express';
import { parentPortalController } from './parent-portal.controller';
import { parentAuthorizationGuard } from './parent-guard.middleware';

const router = Router();

// All parent portal routes are protected by the parent authorization guard.
// The guard ensures:
// - User is authenticated with 'parent' role
// - Child links are resolved from DB (not from request)
// - Referenced childIds are validated against resolved set
//
// NO POST/PUT/PATCH/DELETE endpoints exist for parent role (Req 16.6, 16.7, 16.11)

// GET /parent/periods — list linked children's billing periods with status
router.get('/periods', parentAuthorizationGuard, parentPortalController.listPeriods);

// GET /parent/history — payment history for linked children
router.get('/history', parentAuthorizationGuard, parentPortalController.listHistory);

// GET /parent/balances — outstanding balances per child
router.get('/balances', parentAuthorizationGuard, parentPortalController.listBalances);

// GET /parent/receipts/:id — view receipt (authorized child only)
router.get('/receipts/:id', parentAuthorizationGuard, parentPortalController.viewReceipt);

export default router;
