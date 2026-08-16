import { AsyncLocalStorage } from 'async_hooks';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { tenantStorage } from '../middleware/tenancy.middleware';

/** Context for opting into soft-deleted records */
export interface SoftDeleteContext {
  includeDeleted: boolean;
}

/** AsyncLocalStorage instance to bypass soft-delete filtering */
export const softDeleteStorage = new AsyncLocalStorage<SoftDeleteContext>();

/** Models that support soft-deletion */
export const SOFT_DELETABLE_MODELS = new Set([
  'School',
  'User',
  'Child',
  'Classroom',
]);

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createTenantScopedClient> | undefined;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createTenantScopedClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);

  const baseClient = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return baseClient.$extends({
    query: {
      $allModels: {
        async findMany({ args, query, model }) {
          applyQueryFilters(args, model, 'read');
          return query(args);
        },
        async findFirst({ args, query, model }) {
          applyQueryFilters(args, model, 'read');
          return query(args);
        },
        async findUnique({ args, query, model }) {
          applyQueryFilters(args, model, 'read');
          return query(args);
        },
        async count({ args, query, model }) {
          applyQueryFilters(args, model, 'read');
          return query(args);
        },
        async aggregate({ args, query, model }) {
          applyQueryFilters(args, model, 'read');
          return query(args);
        },
        async create({ args, query, model }) {
          applyQueryFilters(args, model, 'create');
          return query(args);
        },
        async createMany({ args, query, model }) {
          applyQueryFilters(args, model, 'createMany');
          return query(args);
        },
        async update({ args, query, model }) {
          applyQueryFilters(args, model, 'read');
          return query(args);
        },
        async updateMany({ args, query, model }) {
          applyQueryFilters(args, model, 'read');
          return query(args);
        },
        async delete({ args, query, model }) {
          applyQueryFilters(args, model, 'read');
          return query(args);
        },
        async deleteMany({ args, query, model }) {
          applyQueryFilters(args, model, 'read');
          return query(args);
        },
      },
    },
  });
}

/** Models that don't have a schoolId field */
const MODELS_WITHOUT_SCHOOL_ID = new Set([
  'School',
  'RefreshToken',
  'PasswordResetToken',
  'InvitationToken',
  'ClassroomEnrollment',
  'ParentChildLink',
  'EmergencyContact',
  'MedicalNote',
  'DailyReportPhoto',
  'Message',
  'ConsentForm',
  'PaymentAuditLog',
  'Notification',
  // Payment management models (scoped via Branch → School, not direct schoolId)
  'Branch',
  'BranchBillingConfig',
  'BranchCalendar',
  'BranchFee',
  'Enrollment',
  'BillingPeriod',
  'PaymentRecord',
  'PaymentAllocation',
  'PaymentAuditEntry',
]);

function applyQueryFilters(
  args: Record<string, unknown>,
  model: string,
  operation: 'read' | 'create' | 'createMany'
): void {
  const tenantContext = tenantStorage.getStore();
  const softDeleteContext = softDeleteStorage.getStore();

  // Tenant scoping (existing logic)
  if (tenantContext?.schoolId && !MODELS_WITHOUT_SCHOOL_ID.has(model)) {
    if (operation === 'create') {
      args.data = { ...(args.data as Record<string, unknown>), schoolId: tenantContext.schoolId };
    } else if (operation === 'createMany') {
      const data = args.data;
      if (Array.isArray(data)) {
        args.data = data.map((item: Record<string, unknown>) => ({
          ...item,
          schoolId: tenantContext.schoolId,
        }));
      } else {
        args.data = { ...(data as Record<string, unknown>), schoolId: tenantContext.schoolId };
      }
    } else {
      // read/update/delete operations - add where filter
      args.where = { ...(args.where as Record<string, unknown>), schoolId: tenantContext.schoolId };
    }
  }

  // Soft-delete filtering (new logic)
  if (
    SOFT_DELETABLE_MODELS.has(model) &&
    operation !== 'create' &&
    operation !== 'createMany' &&
    !softDeleteContext?.includeDeleted
  ) {
    args.where = { ...(args.where as Record<string, unknown>), deletedAt: null };
  }
}

export const prisma =
  globalForPrisma.prisma ?? createTenantScopedClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
