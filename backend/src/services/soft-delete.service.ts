import prisma, { softDeleteStorage } from '../lib/prisma';

export type SoftDeletableModel = 'school' | 'user' | 'child' | 'classroom';

export class SoftDeleteError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'SoftDeleteError';
  }
}

class SoftDeleteService {
  /**
   * Soft-delete an entity by setting deletedAt to current UTC timestamp.
   * Throws if the entity is already deleted or not found.
   */
  async softDelete(model: SoftDeletableModel, id: string, schoolId?: string): Promise<void> {
    const record = await this.findIncludingDeleted(model, id, schoolId);

    if (!record) {
      throw new SoftDeleteError(`${model} not found`, 404);
    }

    if (record.deletedAt !== null) {
      throw new SoftDeleteError(`${model} is already deleted`, 409);
    }

    await (prisma[model] as any).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft-deleted entity by setting deletedAt to null.
   * Throws if the entity is not deleted or not found.
   */
  async restore(model: SoftDeletableModel, id: string, schoolId?: string): Promise<unknown> {
    const record = await this.findIncludingDeleted(model, id, schoolId);

    if (!record) {
      throw new SoftDeleteError(`${model} not found`, 404);
    }

    if (record.deletedAt === null) {
      throw new SoftDeleteError(`${model} is not deleted`, 409);
    }

    // Use softDeleteStorage bypass to update a deleted record
    return softDeleteStorage.run({ includeDeleted: true }, async () => {
      return (prisma[model] as any).update({
        where: { id },
        data: { deletedAt: null },
      });
    });
  }

  /**
   * Permanently delete a soft-deleted entity from the database.
   * Throws if the entity is not deleted, not found, or has referential constraints.
   */
  async hardDelete(model: SoftDeletableModel, id: string, schoolId?: string): Promise<void> {
    const record = await this.findIncludingDeleted(model, id, schoolId);

    if (!record) {
      throw new SoftDeleteError(`${model} not found`, 404);
    }

    if (record.deletedAt === null) {
      throw new SoftDeleteError(`Only deleted records can be permanently removed`, 409);
    }

    try {
      await softDeleteStorage.run({ includeDeleted: true }, async () => {
        await (prisma[model] as any).delete({ where: { id } });
      });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new SoftDeleteError(
          `Cannot permanently delete: this ${model} has dependent records that would violate referential integrity`,
          409,
        );
      }
      throw error;
    }
  }

  /**
   * List all soft-deleted records for a model within a school scope.
   * If schoolId is empty, lists across all schools (super_admin).
   */
  async listDeleted(
    model: SoftDeletableModel,
    schoolId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: unknown[]; total: number }> {
    return softDeleteStorage.run({ includeDeleted: true }, async () => {
      const where =
        model === 'school' || !schoolId
          ? { deletedAt: { not: null } }
          : { schoolId, deletedAt: { not: null } };

      const [data, total] = await Promise.all([
        (prisma[model] as any).findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { deletedAt: 'desc' },
        }),
        (prisma[model] as any).count({ where }),
      ]);

      return { data, total };
    });
  }

  /**
   * Internal helper to find a record including deleted ones.
   */
  private async findIncludingDeleted(
    model: SoftDeletableModel,
    id: string,
    schoolId?: string,
  ): Promise<any> {
    return softDeleteStorage.run({ includeDeleted: true }, async () => {
      const where: any = { id };
      if (schoolId && model !== 'school') {
        where.schoolId = schoolId;
      }
      return (prisma[model] as any).findFirst({ where });
    });
  }
}

export const softDeleteService = new SoftDeleteService();
