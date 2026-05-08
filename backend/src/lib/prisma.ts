import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { tenantStorage } from '../middleware/tenancy.middleware';

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
          applyTenantFilter(args, model, 'read');
          return query(args);
        },
        async findFirst({ args, query, model }) {
          applyTenantFilter(args, model, 'read');
          return query(args);
        },
        async findUnique({ args, query, model }) {
          applyTenantFilter(args, model, 'read');
          return query(args);
        },
        async count({ args, query, model }) {
          applyTenantFilter(args, model, 'read');
          return query(args);
        },
        async aggregate({ args, query, model }) {
          applyTenantFilter(args, model, 'read');
          return query(args);
        },
        async create({ args, query, model }) {
          applyTenantFilter(args, model, 'create');
          return query(args);
        },
        async createMany({ args, query, model }) {
          applyTenantFilter(args, model, 'createMany');
          return query(args);
        },
        async update({ args, query, model }) {
          applyTenantFilter(args, model, 'read');
          return query(args);
        },
        async updateMany({ args, query, model }) {
          applyTenantFilter(args, model, 'read');
          return query(args);
        },
        async delete({ args, query, model }) {
          applyTenantFilter(args, model, 'read');
          return query(args);
        },
        async deleteMany({ args, query, model }) {
          applyTenantFilter(args, model, 'read');
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
]);

function applyTenantFilter(
  args: Record<string, unknown>,
  model: string,
  operation: 'read' | 'create' | 'createMany'
): void {
  const context = tenantStorage.getStore();

  if (!context?.schoolId || MODELS_WITHOUT_SCHOOL_ID.has(model)) {
    return;
  }

  if (operation === 'create') {
    args.data = { ...(args.data as Record<string, unknown>), schoolId: context.schoolId };
  } else if (operation === 'createMany') {
    const data = args.data;
    if (Array.isArray(data)) {
      args.data = data.map((item: Record<string, unknown>) => ({
        ...item,
        schoolId: context.schoolId,
      }));
    } else {
      args.data = { ...(data as Record<string, unknown>), schoolId: context.schoolId };
    }
  } else {
    // read/update/delete operations - add where filter
    args.where = { ...(args.where as Record<string, unknown>), schoolId: context.schoolId };
  }
}

export const prisma =
  globalForPrisma.prisma ?? createTenantScopedClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
