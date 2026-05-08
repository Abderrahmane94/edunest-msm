import { describe, it, expect, vi, beforeEach } from 'vitest';
import { financeService, FinanceServiceError } from './finance.service';

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  default: {
    feeStructure: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    academicYear: {
      findFirst: vi.fn(),
    },
    invoice: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    child: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    classroom: {
      findFirst: vi.fn(),
    },
    classroomEnrollment: {
      findMany: vi.fn(),
    },
    discount: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cashPayment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    paymentAuditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock notification service
vi.mock('../../services/notification.service', () => ({
  notificationService: {
    notify: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Chargily gateway
vi.mock('../../services/chargily.gateway', () => ({
  chargilyGateway: {
    createCheckout: vi.fn().mockResolvedValue({
      id: 'chk_mock_123',
      checkoutUrl: 'https://pay.chargily.net/test/checkouts/chk_mock_123',
      status: 'pending',
    }),
    verifyWebhookSignature: vi.fn().mockReturnValue(true),
    getCheckout: vi.fn().mockResolvedValue({ id: 'chk_mock_123', status: 'pending', amount: 0, currency: 'dzd', metadata: {} }),
  },
}));

import prisma from '../../lib/prisma';

const mockPrisma = prisma as unknown as {
  feeStructure: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  academicYear: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  invoice: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  child: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  classroom: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  classroomEnrollment: {
    findMany: ReturnType<typeof vi.fn>;
  };
  discount: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  cashPayment: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  paymentAuditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

describe('FinanceService', () => {
  const schoolId = 'school-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFeeStructure', () => {
    it('should create a fee structure with valid input', async () => {
      const input = {
        academicYearId: 'ay-1',
        name: 'Monthly Tuition',
        amount: 15000,
        currency: 'DZD' as const,
        frequency: 'monthly' as const,
        level: 'petite section',
        description: 'Monthly tuition fee',
      };

      const academicYear = { id: 'ay-1', schoolId, name: '2024-2025' };
      const expected = {
        id: 'fs-1',
        schoolId,
        academicYearId: 'ay-1',
        name: 'Monthly Tuition',
        amount: 15000,
        currency: 'DZD',
        frequency: 'monthly',
        level: 'petite section',
        description: 'Monthly tuition fee',
        createdAt: new Date(),
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue(academicYear);
      mockPrisma.feeStructure.create.mockResolvedValue(expected);

      const result = await financeService.createFeeStructure(schoolId, input);

      expect(mockPrisma.academicYear.findFirst).toHaveBeenCalledWith({
        where: { id: 'ay-1', schoolId },
      });
      expect(mockPrisma.feeStructure.create).toHaveBeenCalledWith({
        data: {
          schoolId,
          academicYearId: 'ay-1',
          name: 'Monthly Tuition',
          amount: 15000,
          currency: 'DZD',
          frequency: 'monthly',
          level: 'petite section',
          description: 'Monthly tuition fee',
        },
      });
      expect(result).toEqual(expected);
    });

    it('should default currency to DZD when not provided', async () => {
      const input = {
        academicYearId: 'ay-1',
        name: 'Annual Fee',
        amount: 120000,
        frequency: 'annual' as const,
      };

      const academicYear = { id: 'ay-1', schoolId, name: '2024-2025' };
      mockPrisma.academicYear.findFirst.mockResolvedValue(academicYear);
      mockPrisma.feeStructure.create.mockResolvedValue({ id: 'fs-2', ...input, schoolId, currency: 'DZD' });

      await financeService.createFeeStructure(schoolId, input);

      expect(mockPrisma.feeStructure.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ currency: 'DZD' }),
      });
    });

    it('should throw 404 when academic year not found', async () => {
      const input = {
        academicYearId: 'nonexistent',
        name: 'Fee',
        amount: 5000,
        frequency: 'monthly' as const,
      };

      mockPrisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(financeService.createFeeStructure(schoolId, input)).rejects.toThrow(
        FinanceServiceError,
      );
      await expect(financeService.createFeeStructure(schoolId, input)).rejects.toMatchObject({
        message: 'Academic year not found',
        statusCode: 404,
      });
    });
  });

  describe('listFeeStructures', () => {
    it('should return paginated fee structures for a school', async () => {
      const feeStructures = [
        { id: 'fs-1', schoolId, name: 'Monthly Tuition', amount: 15000, currency: 'DZD', frequency: 'monthly', createdAt: new Date() },
        { id: 'fs-2', schoolId, name: 'Annual Fee', amount: 120000, currency: 'DZD', frequency: 'annual', createdAt: new Date() },
      ];

      mockPrisma.feeStructure.findMany.mockResolvedValue(feeStructures);
      mockPrisma.feeStructure.count.mockResolvedValue(2);

      const result = await financeService.listFeeStructures(schoolId, 1, 20);

      expect(result.feeStructures).toEqual(feeStructures);
      expect(result.total).toBe(2);
      expect(mockPrisma.feeStructure.findMany).toHaveBeenCalledWith({
        where: { schoolId },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply correct pagination offset', async () => {
      mockPrisma.feeStructure.findMany.mockResolvedValue([]);
      mockPrisma.feeStructure.count.mockResolvedValue(0);

      await financeService.listFeeStructures(schoolId, 3, 10);

      expect(mockPrisma.feeStructure.findMany).toHaveBeenCalledWith({
        where: { schoolId },
        skip: 20,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getFeeStructureById', () => {
    it('should return a fee structure when found', async () => {
      const feeStructure = {
        id: 'fs-1',
        schoolId,
        academicYearId: 'ay-1',
        name: 'Monthly Tuition',
        amount: 15000,
        currency: 'DZD',
        frequency: 'monthly',
        level: null,
        description: null,
        createdAt: new Date(),
      };

      mockPrisma.feeStructure.findFirst.mockResolvedValue(feeStructure);

      const result = await financeService.getFeeStructureById('fs-1', schoolId);

      expect(result).toEqual(feeStructure);
      expect(mockPrisma.feeStructure.findFirst).toHaveBeenCalledWith({
        where: { id: 'fs-1', schoolId },
      });
    });

    it('should throw 404 when fee structure not found', async () => {
      mockPrisma.feeStructure.findFirst.mockResolvedValue(null);

      await expect(financeService.getFeeStructureById('nonexistent', schoolId)).rejects.toThrow(
        FinanceServiceError,
      );
      await expect(financeService.getFeeStructureById('nonexistent', schoolId)).rejects.toMatchObject({
        message: 'Fee structure not found',
        statusCode: 404,
      });
    });
  });

  describe('updateFeeStructure', () => {
    it('should update a fee structure when no invoices exist', async () => {
      const feeStructure = {
        id: 'fs-1',
        schoolId,
        academicYearId: 'ay-1',
        name: 'Monthly Tuition',
        amount: 15000,
        currency: 'DZD',
        frequency: 'monthly',
        level: null,
        description: null,
        createdAt: new Date(),
      };

      const updated = { ...feeStructure, name: 'Updated Tuition', amount: 18000 };

      mockPrisma.feeStructure.findFirst.mockResolvedValue(feeStructure);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.feeStructure.update.mockResolvedValue(updated);

      const result = await financeService.updateFeeStructure('fs-1', schoolId, {
        name: 'Updated Tuition',
        amount: 18000,
      });

      expect(result).toEqual(updated);
      expect(mockPrisma.feeStructure.update).toHaveBeenCalledWith({
        where: { id: 'fs-1' },
        data: { name: 'Updated Tuition', amount: 18000 },
      });
    });

    it('should throw 404 when fee structure not found', async () => {
      mockPrisma.feeStructure.findFirst.mockResolvedValue(null);

      await expect(
        financeService.updateFeeStructure('nonexistent', schoolId, { name: 'New Name' }),
      ).rejects.toMatchObject({
        message: 'Fee structure not found',
        statusCode: 404,
      });
    });

    it('should throw 409 when invoices are associated', async () => {
      const feeStructure = {
        id: 'fs-1',
        schoolId,
        name: 'Monthly Tuition',
        amount: 15000,
        createdAt: new Date(),
      };

      mockPrisma.feeStructure.findFirst.mockResolvedValue(feeStructure);
      mockPrisma.invoice.count.mockResolvedValue(3);

      await expect(
        financeService.updateFeeStructure('fs-1', schoolId, { name: 'New Name' }),
      ).rejects.toMatchObject({
        message: 'Cannot update fee structure with associated invoices',
        statusCode: 409,
      });
    });
  });

  describe('deleteFeeStructure', () => {
    it('should delete a fee structure when no invoices exist', async () => {
      const feeStructure = {
        id: 'fs-1',
        schoolId,
        name: 'Monthly Tuition',
        amount: 15000,
        createdAt: new Date(),
      };

      mockPrisma.feeStructure.findFirst.mockResolvedValue(feeStructure);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.feeStructure.delete.mockResolvedValue(feeStructure);

      await financeService.deleteFeeStructure('fs-1', schoolId);

      expect(mockPrisma.feeStructure.delete).toHaveBeenCalledWith({
        where: { id: 'fs-1' },
      });
    });

    it('should throw 404 when fee structure not found', async () => {
      mockPrisma.feeStructure.findFirst.mockResolvedValue(null);

      await expect(
        financeService.deleteFeeStructure('nonexistent', schoolId),
      ).rejects.toMatchObject({
        message: 'Fee structure not found',
        statusCode: 404,
      });
    });

    it('should throw 409 when invoices are associated', async () => {
      const feeStructure = {
        id: 'fs-1',
        schoolId,
        name: 'Monthly Tuition',
        amount: 15000,
        createdAt: new Date(),
      };

      mockPrisma.feeStructure.findFirst.mockResolvedValue(feeStructure);
      mockPrisma.invoice.count.mockResolvedValue(5);

      await expect(
        financeService.deleteFeeStructure('fs-1', schoolId),
      ).rejects.toMatchObject({
        message: 'Cannot delete fee structure with associated invoices',
        statusCode: 409,
      });
    });
  });

  // ─── Invoice Tests ─────────────────────────────────────────────────────────

  describe('createInvoice', () => {
    const invoiceInput = {
      childId: 'child-1',
      parentUserId: 'parent-1',
      feeStructureId: 'fs-1',
      amount: 15000,
      dueDate: '2024-06-15',
    };

    it('should create an invoice with no discounts', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({ id: 'child-1', schoolId });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'parent-1', schoolId, role: 'parent' });
      mockPrisma.feeStructure.findFirst.mockResolvedValue({ id: 'fs-1', schoolId });
      mockPrisma.discount.findMany.mockResolvedValue([]);

      const expectedInvoice = {
        id: 'inv-1',
        schoolId,
        childId: 'child-1',
        parentUserId: 'parent-1',
        feeStructureId: 'fs-1',
        amount: 15000,
        discountAmount: 0,
        finalAmount: 15000,
        remainingAmount: 15000,
        currency: 'DZD',
        dueDate: new Date('2024-06-15'),
        status: 'draft',
        createdAt: new Date(),
      };

      mockPrisma.invoice.create.mockResolvedValue(expectedInvoice);

      const result = await financeService.createInvoice(schoolId, invoiceInput);

      expect(result).toEqual(expectedInvoice);
      expect(mockPrisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          schoolId,
          childId: 'child-1',
          parentUserId: 'parent-1',
          feeStructureId: 'fs-1',
          amount: 15000,
          discountAmount: 0,
          finalAmount: 15000,
          remainingAmount: 15000,
          currency: 'DZD',
          status: 'draft',
        }),
      });
    });

    it('should auto-apply active discounts and calculate final_amount', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({ id: 'child-1', schoolId });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'parent-1', schoolId, role: 'parent' });
      mockPrisma.feeStructure.findFirst.mockResolvedValue({ id: 'fs-1', schoolId });
      mockPrisma.discount.findMany.mockResolvedValue([
        { id: 'd-1', childId: 'child-1', percentage: 10, validFrom: new Date('2024-01-01'), validTo: null },
        { id: 'd-2', childId: 'child-1', percentage: 5, validFrom: new Date('2024-01-01'), validTo: new Date('2025-12-31') },
      ]);

      const expectedInvoice = {
        id: 'inv-1',
        schoolId,
        childId: 'child-1',
        parentUserId: 'parent-1',
        feeStructureId: 'fs-1',
        amount: 15000,
        discountAmount: 2250, // 15% of 15000
        finalAmount: 12750,
        remainingAmount: 12750,
        currency: 'DZD',
        dueDate: new Date('2024-06-15'),
        status: 'draft',
        createdAt: new Date(),
      };

      mockPrisma.invoice.create.mockResolvedValue(expectedInvoice);

      const result = await financeService.createInvoice(schoolId, invoiceInput);

      expect(result).toEqual(expectedInvoice);
      expect(mockPrisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          discountAmount: 2250,
          finalAmount: 12750,
          remainingAmount: 12750,
        }),
      });
    });

    it('should throw 404 when child not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(
        financeService.createInvoice(schoolId, invoiceInput),
      ).rejects.toMatchObject({
        message: 'Child not found',
        statusCode: 404,
      });
    });

    it('should throw 404 when parent user not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({ id: 'child-1', schoolId });
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        financeService.createInvoice(schoolId, invoiceInput),
      ).rejects.toMatchObject({
        message: 'Parent user not found',
        statusCode: 404,
      });
    });

    it('should throw 404 when fee structure not found', async () => {
      mockPrisma.child.findFirst.mockResolvedValue({ id: 'child-1', schoolId });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'parent-1', schoolId, role: 'parent' });
      mockPrisma.feeStructure.findFirst.mockResolvedValue(null);

      await expect(
        financeService.createInvoice(schoolId, invoiceInput),
      ).rejects.toMatchObject({
        message: 'Fee structure not found',
        statusCode: 404,
      });
    });
  });

  describe('bulkGenerateInvoices', () => {
    const bulkInput = {
      classroomId: 'classroom-1',
      feeStructureId: 'fs-1',
      amount: 10000,
      dueDate: '2024-07-01',
    };

    it('should generate one invoice per enrolled child', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue({ id: 'classroom-1', schoolId });
      mockPrisma.feeStructure.findFirst.mockResolvedValue({ id: 'fs-1', schoolId });
      mockPrisma.classroomEnrollment.findMany.mockResolvedValue([
        {
          child: {
            id: 'child-1',
            parentLinks: [{ parentUserId: 'parent-1' }],
          },
        },
        {
          child: {
            id: 'child-2',
            parentLinks: [{ parentUserId: 'parent-2' }],
          },
        },
      ]);
      mockPrisma.discount.findMany.mockResolvedValue([]);

      mockPrisma.invoice.create
        .mockResolvedValueOnce({
          id: 'inv-1',
          schoolId,
          childId: 'child-1',
          parentUserId: 'parent-1',
          amount: 10000,
          discountAmount: 0,
          finalAmount: 10000,
          status: 'draft',
        })
        .mockResolvedValueOnce({
          id: 'inv-2',
          schoolId,
          childId: 'child-2',
          parentUserId: 'parent-2',
          amount: 10000,
          discountAmount: 0,
          finalAmount: 10000,
          status: 'draft',
        });

      const result = await financeService.bulkGenerateInvoices(schoolId, bulkInput);

      expect(result).toHaveLength(2);
      expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(2);
    });

    it('should skip children without a primary parent link', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue({ id: 'classroom-1', schoolId });
      mockPrisma.feeStructure.findFirst.mockResolvedValue({ id: 'fs-1', schoolId });
      mockPrisma.classroomEnrollment.findMany.mockResolvedValue([
        {
          child: {
            id: 'child-1',
            parentLinks: [{ parentUserId: 'parent-1' }],
          },
        },
        {
          child: {
            id: 'child-2',
            parentLinks: [], // No primary parent
          },
        },
      ]);
      mockPrisma.discount.findMany.mockResolvedValue([]);

      mockPrisma.invoice.create.mockResolvedValue({
        id: 'inv-1',
        schoolId,
        childId: 'child-1',
        parentUserId: 'parent-1',
        amount: 10000,
        discountAmount: 0,
        finalAmount: 10000,
        status: 'draft',
      });

      const result = await financeService.bulkGenerateInvoices(schoolId, bulkInput);

      expect(result).toHaveLength(1);
      expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(1);
    });

    it('should throw 404 when classroom not found', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue(null);

      await expect(
        financeService.bulkGenerateInvoices(schoolId, bulkInput),
      ).rejects.toMatchObject({
        message: 'Classroom not found',
        statusCode: 404,
      });
    });

    it('should throw 404 when fee structure not found', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue({ id: 'classroom-1', schoolId });
      mockPrisma.feeStructure.findFirst.mockResolvedValue(null);

      await expect(
        financeService.bulkGenerateInvoices(schoolId, bulkInput),
      ).rejects.toMatchObject({
        message: 'Fee structure not found',
        statusCode: 404,
      });
    });

    it('should throw 400 when no enrolled children found', async () => {
      mockPrisma.classroom.findFirst.mockResolvedValue({ id: 'classroom-1', schoolId });
      mockPrisma.feeStructure.findFirst.mockResolvedValue({ id: 'fs-1', schoolId });
      mockPrisma.classroomEnrollment.findMany.mockResolvedValue([]);

      await expect(
        financeService.bulkGenerateInvoices(schoolId, bulkInput),
      ).rejects.toMatchObject({
        message: 'No enrolled children found in this classroom',
        statusCode: 400,
      });
    });
  });

  describe('listInvoices', () => {
    it('should return paginated invoices for a school', async () => {
      const invoices = [
        { id: 'inv-1', schoolId, status: 'draft', createdAt: new Date() },
        { id: 'inv-2', schoolId, status: 'sent', createdAt: new Date() },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(invoices);
      mockPrisma.invoice.count.mockResolvedValue(2);

      const result = await financeService.listInvoices(schoolId, 1, 20);

      expect(result.invoices).toEqual(invoices);
      expect(result.total).toBe(2);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
        where: { schoolId },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getInvoiceById', () => {
    it('should return an invoice when found by admin', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
        status: 'draft',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

      const result = await financeService.getInvoiceById('inv-1', schoolId, 'admin-1', 'admin');

      expect(result).toEqual(invoice);
    });

    it('should return an invoice when parent is the owner', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
        status: 'sent',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

      const result = await financeService.getInvoiceById('inv-1', schoolId, 'parent-1', 'parent');

      expect(result).toEqual(invoice);
    });

    it('should throw 404 when parent tries to access another parents invoice', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
        status: 'sent',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        financeService.getInvoiceById('inv-1', schoolId, 'parent-2', 'parent'),
      ).rejects.toMatchObject({
        message: 'Invoice not found',
        statusCode: 404,
      });
    });

    it('should throw 404 when invoice not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        financeService.getInvoiceById('nonexistent', schoolId),
      ).rejects.toMatchObject({
        message: 'Invoice not found',
        statusCode: 404,
      });
    });
  });

  describe('sendInvoice', () => {
    it('should send a draft invoice and update status to sent', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
        finalAmount: 15000,
        currency: 'DZD',
        dueDate: new Date('2024-06-15'),
        status: 'draft',
      };

      const updatedInvoice = {
        ...invoice,
        status: 'sent',
        issuedAt: new Date(),
        chargilyCheckoutId: 'chk_mock_123',
        chargilyPaymentUrl: 'https://pay.chargily.net/test/checkouts/chk_mock_123',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
      mockPrisma.user.findUnique.mockResolvedValue({ preferredLanguage: 'fr' });
      mockPrisma.invoice.update.mockResolvedValue(updatedInvoice);

      const result = await financeService.sendInvoice('inv-1', schoolId);

      expect(result.status).toBe('sent');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: {
          status: 'sent',
          issuedAt: expect.any(Date),
          chargilyCheckoutId: 'chk_mock_123',
          chargilyPaymentUrl: 'https://pay.chargily.net/test/checkouts/chk_mock_123',
        },
      });
    });

    it('should throw 400 when trying to send a non-draft invoice', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
        status: 'sent',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        financeService.sendInvoice('inv-1', schoolId),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 when invoice not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        financeService.sendInvoice('nonexistent', schoolId),
      ).rejects.toMatchObject({
        message: 'Invoice not found',
        statusCode: 404,
      });
    });
  });

  describe('cancelInvoice', () => {
    it('should cancel a draft invoice', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        status: 'draft',
      };

      const updatedInvoice = { ...invoice, status: 'cancelled' };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
      mockPrisma.invoice.update.mockResolvedValue(updatedInvoice);

      const result = await financeService.cancelInvoice('inv-1', schoolId);

      expect(result.status).toBe('cancelled');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'cancelled' },
      });
    });

    it('should cancel a sent invoice', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        status: 'sent',
      };

      const updatedInvoice = { ...invoice, status: 'cancelled' };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
      mockPrisma.invoice.update.mockResolvedValue(updatedInvoice);

      const result = await financeService.cancelInvoice('inv-1', schoolId);

      expect(result.status).toBe('cancelled');
    });

    it('should throw 400 when trying to cancel a paid invoice', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        status: 'paid',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        financeService.cancelInvoice('inv-1', schoolId),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 when invoice not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        financeService.cancelInvoice('nonexistent', schoolId),
      ).rejects.toMatchObject({
        message: 'Invoice not found',
        statusCode: 404,
      });
    });
  });

  // ─── Cash Payment Tests ────────────────────────────────────────────────────

  describe('recordCashPayment', () => {
    const cashPaymentInput = {
      amount_received: 15000,
      received_by: 'admin-1',
      received_at: '2024-06-15T10:30:00.000Z',
      note: 'Paid in cash at office',
    };

    it('should record a full cash payment and set status to paid', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
        finalAmount: 15000,
        remainingAmount: 15000,
        currency: 'DZD',
        status: 'sent',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
      mockPrisma.invoice.update.mockResolvedValue({ ...invoice, status: 'paid', remainingAmount: 0 });
      mockPrisma.cashPayment.create.mockResolvedValue({
        id: 'cp-1',
        invoiceId: 'inv-1',
        schoolId,
        amount: 15000,
        receivedBy: 'admin-1',
        receivedAt: new Date('2024-06-15T10:30:00.000Z'),
        note: 'Paid in cash at office',
        createdAt: new Date(),
      });
      mockPrisma.paymentAuditLog.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Admin', lastName: 'User' });

      const result = await financeService.recordCashPayment('inv-1', schoolId, cashPaymentInput, 'admin-1');

      expect(result.id).toBe('cp-1');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          status: 'paid',
          paymentMethod: 'cash',
          remainingAmount: 0,
        }),
      });
      expect(mockPrisma.paymentAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: 'inv-1',
          action: 'cash_payment_recorded',
          performedBy: 'admin-1',
          previousStatus: 'sent',
          newStatus: 'paid',
        }),
      });
    });

    it('should record a partial cash payment and set status to partial', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
        finalAmount: 15000,
        remainingAmount: 15000,
        currency: 'DZD',
        status: 'sent',
      };

      const partialInput = { ...cashPaymentInput, amount_received: 5000 };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
      mockPrisma.invoice.update.mockResolvedValue({ ...invoice, status: 'partial', remainingAmount: 10000 });
      mockPrisma.cashPayment.create.mockResolvedValue({
        id: 'cp-1',
        invoiceId: 'inv-1',
        schoolId,
        amount: 5000,
        receivedBy: 'admin-1',
        receivedAt: new Date('2024-06-15T10:30:00.000Z'),
        note: 'Paid in cash at office',
        createdAt: new Date(),
      });
      mockPrisma.paymentAuditLog.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Admin', lastName: 'User' });

      const result = await financeService.recordCashPayment('inv-1', schoolId, partialInput, 'admin-1');

      expect(result.amount).toBe(5000);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          status: 'partial',
          paymentMethod: 'cash',
          remainingAmount: 10000,
        }),
      });
      expect(mockPrisma.paymentAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          newStatus: 'partial',
        }),
      });
    });

    it('should allow subsequent payment on partial invoice to reach paid', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
        finalAmount: 15000,
        remainingAmount: 5000,
        currency: 'DZD',
        status: 'partial',
      };

      const finalInput = { ...cashPaymentInput, amount_received: 5000 };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
      mockPrisma.invoice.update.mockResolvedValue({ ...invoice, status: 'paid', remainingAmount: 0 });
      mockPrisma.cashPayment.create.mockResolvedValue({
        id: 'cp-2',
        invoiceId: 'inv-1',
        schoolId,
        amount: 5000,
        receivedBy: 'admin-1',
        receivedAt: new Date('2024-06-15T10:30:00.000Z'),
        note: 'Paid in cash at office',
        createdAt: new Date(),
      });
      mockPrisma.paymentAuditLog.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'Admin', lastName: 'User' });

      const result = await financeService.recordCashPayment('inv-1', schoolId, finalInput, 'admin-1');

      expect(result.id).toBe('cp-2');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          status: 'paid',
          remainingAmount: 0,
        }),
      });
    });

    it('should throw 400 when invoice is cancelled', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
        status: 'cancelled',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        financeService.recordCashPayment('inv-1', schoolId, cashPaymentInput, 'admin-1'),
      ).rejects.toMatchObject({
        message: 'Cannot record payment on a cancelled invoice',
        statusCode: 400,
      });
    });

    it('should throw 400 when invoice is already fully paid', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
        status: 'paid',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        financeService.recordCashPayment('inv-1', schoolId, cashPaymentInput, 'admin-1'),
      ).rejects.toMatchObject({
        message: 'Cannot record payment on a fully paid invoice',
        statusCode: 400,
      });
    });

    it('should throw 404 when invoice not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        financeService.recordCashPayment('nonexistent', schoolId, cashPaymentInput, 'admin-1'),
      ).rejects.toMatchObject({
        message: 'Invoice not found',
        statusCode: 404,
      });
    });
  });

  describe('listCashPayments', () => {
    it('should return cash payments for an invoice', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
      };

      const cashPayments = [
        { id: 'cp-1', invoiceId: 'inv-1', schoolId, amount: 5000, receivedBy: 'admin-1', receivedAt: new Date(), createdAt: new Date() },
        { id: 'cp-2', invoiceId: 'inv-1', schoolId, amount: 10000, receivedBy: 'admin-1', receivedAt: new Date(), createdAt: new Date() },
      ];

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
      mockPrisma.cashPayment.findMany.mockResolvedValue(cashPayments);

      const result = await financeService.listCashPayments('inv-1', schoolId, 'admin-1', 'admin');

      expect(result).toHaveLength(2);
      expect(mockPrisma.cashPayment.findMany).toHaveBeenCalledWith({
        where: { invoiceId: 'inv-1', schoolId },
        orderBy: { receivedAt: 'desc' },
      });
    });

    it('should allow parent to view their own invoice cash payments', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
      mockPrisma.cashPayment.findMany.mockResolvedValue([]);

      const result = await financeService.listCashPayments('inv-1', schoolId, 'parent-1', 'parent');

      expect(result).toHaveLength(0);
    });

    it('should throw 404 when parent tries to view another parents invoice payments', async () => {
      const invoice = {
        id: 'inv-1',
        schoolId,
        parentUserId: 'parent-1',
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        financeService.listCashPayments('inv-1', schoolId, 'parent-2', 'parent'),
      ).rejects.toMatchObject({
        message: 'Invoice not found',
        statusCode: 404,
      });
    });

    it('should throw 404 when invoice not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        financeService.listCashPayments('nonexistent', schoolId, 'admin-1', 'admin'),
      ).rejects.toMatchObject({
        message: 'Invoice not found',
        statusCode: 404,
      });
    });
  });

  describe('getPaymentMethodBreakdown', () => {
    it('should return correct breakdown of online and cash payments', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        { finalAmount: 15000 },
        { finalAmount: 20000 },
      ]);
      mockPrisma.cashPayment.findMany.mockResolvedValue([
        { amount: 5000 },
        { amount: 10000 },
        { amount: 7500 },
      ]);

      const result = await financeService.getPaymentMethodBreakdown(schoolId);

      expect(result.online.count).toBe(2);
      expect(result.online.total).toBe(35000);
      expect(result.cash.count).toBe(3);
      expect(result.cash.total).toBe(22500);
    });

    it('should return zeros when no payments exist', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.cashPayment.findMany.mockResolvedValue([]);

      const result = await financeService.getPaymentMethodBreakdown(schoolId);

      expect(result.online.count).toBe(0);
      expect(result.online.total).toBe(0);
      expect(result.cash.count).toBe(0);
      expect(result.cash.total).toBe(0);
    });
  });

  // ─── Discount Management Tests ─────────────────────────────────────────────

  describe('createDiscount', () => {
    it('should create a discount with valid input', async () => {
      const input = {
        childId: 'child-1',
        type: 'scholarship' as const,
        percentage: 25,
        description: 'Academic excellence',
        validFrom: '2024-09-01',
        validTo: '2025-06-30',
      };

      const child = { id: 'child-1', schoolId };
      const expected = {
        id: 'disc-1',
        childId: 'child-1',
        schoolId,
        type: 'scholarship',
        percentage: 25,
        description: 'Academic excellence',
        validFrom: new Date('2024-09-01'),
        validTo: new Date('2025-06-30'),
        createdAt: new Date(),
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.discount.create.mockResolvedValue(expected);

      const result = await financeService.createDiscount(schoolId, input);

      expect(mockPrisma.child.findFirst).toHaveBeenCalledWith({
        where: { id: 'child-1', schoolId },
      });
      expect(mockPrisma.discount.create).toHaveBeenCalledWith({
        data: {
          childId: 'child-1',
          schoolId,
          type: 'scholarship',
          percentage: 25,
          description: 'Academic excellence',
          validFrom: new Date('2024-09-01'),
          validTo: new Date('2025-06-30'),
        },
      });
      expect(result).toEqual(expected);
    });

    it('should create a discount with null validTo (no expiry)', async () => {
      const input = {
        childId: 'child-1',
        type: 'staff' as const,
        percentage: 50,
        description: null,
        validFrom: '2024-01-01',
        validTo: null,
      };

      const child = { id: 'child-1', schoolId };
      const expected = {
        id: 'disc-2',
        childId: 'child-1',
        schoolId,
        type: 'staff',
        percentage: 50,
        description: null,
        validFrom: new Date('2024-01-01'),
        validTo: null,
        createdAt: new Date(),
      };

      mockPrisma.child.findFirst.mockResolvedValue(child);
      mockPrisma.discount.create.mockResolvedValue(expected);

      const result = await financeService.createDiscount(schoolId, input);

      expect(mockPrisma.discount.create).toHaveBeenCalledWith({
        data: {
          childId: 'child-1',
          schoolId,
          type: 'staff',
          percentage: 50,
          description: null,
          validFrom: new Date('2024-01-01'),
          validTo: null,
        },
      });
      expect(result.validTo).toBeNull();
    });

    it('should throw 404 when child not found', async () => {
      const input = {
        childId: 'nonexistent',
        type: 'sibling' as const,
        percentage: 10,
        validFrom: '2024-01-01',
      };

      mockPrisma.child.findFirst.mockResolvedValue(null);

      await expect(financeService.createDiscount(schoolId, input)).rejects.toThrow(
        new FinanceServiceError('Child not found', 404),
      );
    });
  });

  describe('listDiscounts', () => {
    it('should return paginated discounts for a school', async () => {
      const discounts = [
        { id: 'disc-1', childId: 'child-1', schoolId, type: 'scholarship', percentage: 20, description: null, validFrom: new Date(), validTo: null, createdAt: new Date() },
      ];

      mockPrisma.discount.findMany.mockResolvedValue(discounts);
      mockPrisma.discount.count.mockResolvedValue(1);

      const result = await financeService.listDiscounts(schoolId, 1, 20);

      expect(mockPrisma.discount.findMany).toHaveBeenCalledWith({
        where: { schoolId },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.discounts).toEqual(discounts);
      expect(result.total).toBe(1);
    });

    it('should filter by childId when provided', async () => {
      mockPrisma.discount.findMany.mockResolvedValue([]);
      mockPrisma.discount.count.mockResolvedValue(0);

      await financeService.listDiscounts(schoolId, 1, 20, 'child-1');

      expect(mockPrisma.discount.findMany).toHaveBeenCalledWith({
        where: { schoolId, childId: 'child-1' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getDiscountById', () => {
    it('should return a discount when found', async () => {
      const discount = {
        id: 'disc-1',
        childId: 'child-1',
        schoolId,
        type: 'scholarship',
        percentage: 25,
        description: 'Merit',
        validFrom: new Date(),
        validTo: null,
        createdAt: new Date(),
      };

      mockPrisma.discount.findFirst.mockResolvedValue(discount);

      const result = await financeService.getDiscountById('disc-1', schoolId);

      expect(mockPrisma.discount.findFirst).toHaveBeenCalledWith({
        where: { id: 'disc-1', schoolId },
      });
      expect(result).toEqual(discount);
    });

    it('should throw 404 when discount not found', async () => {
      mockPrisma.discount.findFirst.mockResolvedValue(null);

      await expect(financeService.getDiscountById('nonexistent', schoolId)).rejects.toThrow(
        new FinanceServiceError('Discount not found', 404),
      );
    });
  });

  describe('updateDiscount', () => {
    it('should update a discount with valid input', async () => {
      const existing = {
        id: 'disc-1',
        childId: 'child-1',
        schoolId,
        type: 'scholarship',
        percentage: 20,
        description: 'Old',
        validFrom: new Date('2024-01-01'),
        validTo: null,
        createdAt: new Date(),
      };

      const updated = { ...existing, percentage: 30, description: 'Updated' };

      mockPrisma.discount.findFirst.mockResolvedValue(existing);
      mockPrisma.discount.update.mockResolvedValue(updated);

      const result = await financeService.updateDiscount('disc-1', schoolId, {
        percentage: 30,
        description: 'Updated',
      });

      expect(mockPrisma.discount.update).toHaveBeenCalledWith({
        where: { id: 'disc-1' },
        data: { percentage: 30, description: 'Updated' },
      });
      expect(result).toEqual(updated);
    });

    it('should throw 404 when discount not found', async () => {
      mockPrisma.discount.findFirst.mockResolvedValue(null);

      await expect(
        financeService.updateDiscount('nonexistent', schoolId, { percentage: 50 }),
      ).rejects.toThrow(new FinanceServiceError('Discount not found', 404));
    });
  });

  describe('deleteDiscount', () => {
    it('should delete a discount when found', async () => {
      const discount = {
        id: 'disc-1',
        childId: 'child-1',
        schoolId,
        type: 'scholarship',
        percentage: 20,
        description: null,
        validFrom: new Date(),
        validTo: null,
        createdAt: new Date(),
      };

      mockPrisma.discount.findFirst.mockResolvedValue(discount);
      mockPrisma.discount.delete.mockResolvedValue(discount);

      await financeService.deleteDiscount('disc-1', schoolId);

      expect(mockPrisma.discount.delete).toHaveBeenCalledWith({
        where: { id: 'disc-1' },
      });
    });

    it('should throw 404 when discount not found', async () => {
      mockPrisma.discount.findFirst.mockResolvedValue(null);

      await expect(financeService.deleteDiscount('nonexistent', schoolId)).rejects.toThrow(
        new FinanceServiceError('Discount not found', 404),
      );
    });
  });
});
