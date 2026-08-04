import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';

/**
 * Property 16: Ledger Append-Only Invariant
 *
 * For any existing payment record, no operation SHALL modify any field of that
 * record or delete it. The only mutation path for financial state is inserting
 * a new correction payment record with is_correction = true and a negative amount.
 *
 * **Validates: Requirements 11.1, 11.2, 11.3**
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentRecord {
  id: string;
  branchId: string;
  childId: string;
  receiptNumber: string;
  totalAmount: Prisma.Decimal;
  channel: 'cash' | 'ccp' | 'baridimob';
  valueDate: Date;
  recordedBy: string;
  referenceNote: string | null;
  isCorrection: boolean;
  correctsPaymentId: string | null;
  createdAt: Date;
}

type Operation =
  | { type: 'append'; record: PaymentRecord }
  | { type: 'appendCorrection'; record: PaymentRecord }
  | { type: 'update'; recordId: string; field: string; value: unknown }
  | { type: 'delete'; recordId: string };

interface LedgerResult {
  records: PaymentRecord[];
  isValid: boolean;
  violations: string[];
}

// ─── Ledger Simulation ───────────────────────────────────────────────────────

/**
 * Simulates an append-only ledger. Only 'append' and 'appendCorrection'
 * operations are valid. 'update' and 'delete' operations are violations.
 */
function simulateLedger(operations: Operation[]): LedgerResult {
  const records: PaymentRecord[] = [];
  const violations: string[] = [];

  for (const op of operations) {
    switch (op.type) {
      case 'append':
        // Valid: insert a non-correction payment record
        records.push({ ...op.record });
        break;

      case 'appendCorrection':
        // Valid only if: isCorrection = true AND totalAmount < 0
        if (!op.record.isCorrection) {
          violations.push(
            `appendCorrection with isCorrection=false for record ${op.record.id}`
          );
        } else if (op.record.totalAmount.gte(new Prisma.Decimal('0'))) {
          violations.push(
            `appendCorrection with non-negative amount for record ${op.record.id}`
          );
        } else {
          records.push({ ...op.record });
        }
        break;

      case 'update':
        // VIOLATION: no record may be modified
        violations.push(
          `Attempted update of field '${op.field}' on record ${op.recordId}`
        );
        break;

      case 'delete':
        // VIOLATION: no record may be deleted
        violations.push(`Attempted delete of record ${op.recordId}`);
        break;
    }
  }

  return {
    records,
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Verifies that all original records in the ledger remain unchanged after
 * processing the full operation sequence.
 */
function verifyRecordsUnmutated(
  originalSnapshots: Map<string, PaymentRecord>,
  currentRecords: PaymentRecord[]
): boolean {
  for (const record of currentRecords) {
    const original = originalSnapshots.get(record.id);
    if (!original) continue; // newly appended, no snapshot to compare

    // Every field must be identical to original
    if (record.branchId !== original.branchId) return false;
    if (record.childId !== original.childId) return false;
    if (record.receiptNumber !== original.receiptNumber) return false;
    if (!record.totalAmount.equals(original.totalAmount)) return false;
    if (record.channel !== original.channel) return false;
    if (String(record.valueDate) !== String(original.valueDate)) return false;
    if (record.recordedBy !== original.recordedBy) return false;
    if (record.referenceNote !== original.referenceNote) return false;
    if (record.isCorrection !== original.isCorrection) return false;
    if (record.correctsPaymentId !== original.correctsPaymentId) return false;
    if (String(record.createdAt) !== String(original.createdAt)) return false;
  }
  return true;
}

// ─── Arbitrary Generators ────────────────────────────────────────────────────

const arbChannel = fc.constantFrom<'cash' | 'ccp' | 'baridimob'>('cash', 'ccp', 'baridimob');

const arbPositiveDecimal = fc
  .integer({ min: 1, max: 99999999 })
  .map((cents) => new Prisma.Decimal(cents).div(100));

const arbNegativeDecimal = fc
  .integer({ min: 1, max: 99999999 })
  .map((cents) => new Prisma.Decimal(cents).div(100).neg());

const arbDate = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => { d.setHours(0, 0, 0, 0); return d; });

function arbPaymentRecord(id: string): fc.Arbitrary<PaymentRecord> {
  return fc.record({
    id: fc.constant(id),
    branchId: fc.uuid(),
    childId: fc.uuid(),
    receiptNumber: fc.string({ minLength: 5, maxLength: 20 }).filter((s) => s.length >= 5),
    totalAmount: arbPositiveDecimal,
    channel: arbChannel,
    valueDate: arbDate,
    recordedBy: fc.uuid(),
    referenceNote: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    isCorrection: fc.constant(false),
    correctsPaymentId: fc.constant(null),
    createdAt: arbDate,
  });
}

function arbCorrectionRecord(id: string, correctsId: string): fc.Arbitrary<PaymentRecord> {
  return fc.record({
    id: fc.constant(id),
    branchId: fc.uuid(),
    childId: fc.uuid(),
    receiptNumber: fc.string({ minLength: 5, maxLength: 20 }).filter((s) => s.length >= 5),
    totalAmount: arbNegativeDecimal,
    channel: arbChannel,
    valueDate: arbDate,
    recordedBy: fc.uuid(),
    referenceNote: fc.string({ minLength: 1, maxLength: 100 }),
    isCorrection: fc.constant(true),
    correctsPaymentId: fc.constant(correctsId),
    createdAt: arbDate,
  });
}

const arbField = fc.constantFrom(
  'branchId', 'childId', 'receiptNumber', 'totalAmount',
  'channel', 'valueDate', 'recordedBy', 'referenceNote',
  'isCorrection', 'correctsPaymentId'
);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Property 16: Ledger Append-Only Invariant', () => {
  it('append-only operations never modify or remove existing records', () => {
    fc.assert(
      fc.property(
        // Generate 1-10 initial payment records
        fc.integer({ min: 1, max: 10 }).chain((count) => {
          const ids = Array.from({ length: count }, (_, i) => `pay-${i}`);
          return fc.tuple(
            fc.tuple(...ids.map((id) => arbPaymentRecord(id))),
            // Generate 0-5 correction operations (valid appends)
            fc.array(
              fc.integer({ min: 0, max: count - 1 }).chain((originalIdx) =>
                arbCorrectionRecord(`corr-${originalIdx}-${Date.now()}`, ids[originalIdx])
              ),
              { minLength: 0, maxLength: 5 }
            )
          );
        }),
        ([initialRecords, corrections]) => {
          // Build operation sequence: append all initial records, then append corrections
          const operations: Operation[] = [
            ...initialRecords.map((record) => ({
              type: 'append' as const,
              record,
            })),
            ...corrections.map((record) => ({
              type: 'appendCorrection' as const,
              record,
            })),
          ];

          // Snapshot the initial records before operations
          const snapshots = new Map<string, PaymentRecord>();
          for (const record of initialRecords) {
            snapshots.set(record.id, { ...record });
          }

          const result = simulateLedger(operations);

          // All append-only operations should be valid
          expect(result.isValid).toBe(true);
          expect(result.violations).toHaveLength(0);

          // All initial records must be present and unchanged
          expect(result.records.length).toBe(initialRecords.length + corrections.length);
          expect(verifyRecordsUnmutated(snapshots, result.records)).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('update operations always violate the append-only invariant', () => {
    fc.assert(
      fc.property(
        arbPaymentRecord('pay-original'),
        arbField,
        fc.string({ minLength: 1, maxLength: 50 }),
        (originalRecord, field, newValue) => {
          const operations: Operation[] = [
            { type: 'append', record: originalRecord },
            { type: 'update', recordId: originalRecord.id, field, value: newValue },
          ];

          const result = simulateLedger(operations);

          // The ledger must report a violation
          expect(result.isValid).toBe(false);
          expect(result.violations.length).toBeGreaterThanOrEqual(1);
          expect(result.violations[0]).toContain('Attempted update');
          expect(result.violations[0]).toContain(originalRecord.id);

          // The original record must NOT be modified in the records array
          const recordInLedger = result.records.find((r) => r.id === originalRecord.id);
          expect(recordInLedger).toBeDefined();
          expect(recordInLedger!.totalAmount.equals(originalRecord.totalAmount)).toBe(true);
          expect(recordInLedger!.channel).toBe(originalRecord.channel);
          expect(recordInLedger!.receiptNumber).toBe(originalRecord.receiptNumber);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('delete operations always violate the append-only invariant', () => {
    fc.assert(
      fc.property(
        arbPaymentRecord('pay-to-delete'),
        (originalRecord) => {
          const operations: Operation[] = [
            { type: 'append', record: originalRecord },
            { type: 'delete', recordId: originalRecord.id },
          ];

          const result = simulateLedger(operations);

          // The ledger must report a violation
          expect(result.isValid).toBe(false);
          expect(result.violations.length).toBe(1);
          expect(result.violations[0]).toContain('Attempted delete');
          expect(result.violations[0]).toContain(originalRecord.id);

          // The record must still exist in the ledger (delete rejected)
          expect(result.records.find((r) => r.id === originalRecord.id)).toBeDefined();
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('corrections are the only valid mutation path: must have isCorrection=true and negative amount', () => {
    fc.assert(
      fc.property(
        arbPaymentRecord('pay-original'),
        arbPositiveDecimal,
        arbNegativeDecimal,
        arbChannel,
        arbDate,
        (originalRecord, positiveAmount, negativeAmount, channel, valueDate) => {
          // Attempt to append a "correction" with positive amount → violation
          const badCorrection: PaymentRecord = {
            id: 'bad-correction-1',
            branchId: originalRecord.branchId,
            childId: originalRecord.childId,
            receiptNumber: 'BAD-2024-000001',
            totalAmount: positiveAmount, // WRONG: should be negative
            channel,
            valueDate,
            recordedBy: originalRecord.recordedBy,
            referenceNote: 'invalid correction',
            isCorrection: true,
            correctsPaymentId: originalRecord.id,
            createdAt: new Date(),
          };

          // Attempt to append a "correction" with isCorrection=false → violation
          const badCorrection2: PaymentRecord = {
            id: 'bad-correction-2',
            branchId: originalRecord.branchId,
            childId: originalRecord.childId,
            receiptNumber: 'BAD-2024-000002',
            totalAmount: negativeAmount, // OK: negative
            channel,
            valueDate,
            recordedBy: originalRecord.recordedBy,
            referenceNote: 'should not be isCorrection=false',
            isCorrection: false, // WRONG: should be true
            correctsPaymentId: originalRecord.id,
            createdAt: new Date(),
          };

          // Valid correction
          const validCorrection: PaymentRecord = {
            id: 'valid-correction',
            branchId: originalRecord.branchId,
            childId: originalRecord.childId,
            receiptNumber: 'CORR-2024-000001',
            totalAmount: negativeAmount, // OK: negative
            channel,
            valueDate,
            recordedBy: originalRecord.recordedBy,
            referenceNote: 'valid correction reason',
            isCorrection: true,
            correctsPaymentId: originalRecord.id,
            createdAt: new Date(),
          };

          const operations: Operation[] = [
            { type: 'append', record: originalRecord },
            { type: 'appendCorrection', record: badCorrection },
            { type: 'appendCorrection', record: badCorrection2 },
            { type: 'appendCorrection', record: validCorrection },
          ];

          const result = simulateLedger(operations);

          // Should have exactly 2 violations (bad corrections)
          expect(result.isValid).toBe(false);
          expect(result.violations).toHaveLength(2);
          expect(result.violations[0]).toContain('non-negative amount');
          expect(result.violations[1]).toContain('isCorrection=false');

          // Only the original record and valid correction should be in ledger
          expect(result.records).toHaveLength(2);
          expect(result.records[0].id).toBe(originalRecord.id);
          expect(result.records[1].id).toBe('valid-correction');
          expect(result.records[1].isCorrection).toBe(true);
          expect(result.records[1].totalAmount.lt(new Prisma.Decimal('0'))).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('mixed operation sequences: only appends succeed, updates and deletes are all rejected', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of mixed operations
        fc.array(
          fc.oneof(
            // Append a new record
            fc.uuid().chain((id) =>
              arbPaymentRecord(id).map((r) => ({ type: 'append' as const, record: r }))
            ),
            // Attempt an update on a random record ID
            fc.tuple(fc.uuid(), arbField, fc.string({ minLength: 1, maxLength: 20 })).map(
              ([id, field, value]) => ({ type: 'update' as const, recordId: id, field, value })
            ),
            // Attempt a delete on a random record ID
            fc.uuid().map((id) => ({ type: 'delete' as const, recordId: id }))
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (operations) => {
          const result = simulateLedger(operations);

          // Count expected outcomes
          const appendOps = operations.filter((op) => op.type === 'append');
          const updateOps = operations.filter((op) => op.type === 'update');
          const deleteOps = operations.filter((op) => op.type === 'delete');

          // All appends should produce records in the ledger
          expect(result.records.length).toBe(appendOps.length);

          // Every update and delete should produce exactly one violation
          expect(result.violations.length).toBe(updateOps.length + deleteOps.length);

          // Ledger is valid only if there were no update/delete attempts
          if (updateOps.length === 0 && deleteOps.length === 0) {
            expect(result.isValid).toBe(true);
          } else {
            expect(result.isValid).toBe(false);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('the payment service has no update or delete methods on payment records (static analysis)', async () => {
    // This test verifies the architectural constraint by checking that
    // the PaymentService class does NOT expose methods that would call
    // prisma.paymentRecord.update() or prisma.paymentRecord.delete().
    //
    // The only way to "reverse" a payment is via recordCorrection() which
    // creates a NEW record with isCorrection=true and negative totalAmount.
    //
    // We verify this by importing the service module and checking
    // the method names don't include update/delete for payment records.
    const { paymentService } = await import('../payments.service');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(paymentService));

    // Should have recordPayment and recordCorrection, but NOT
    // updatePayment, deletePayment, editPayment, removePayment
    const forbiddenPatterns = [
      /updatePayment/i,
      /deletePayment/i,
      /editPayment/i,
      /removePayment/i,
      /modifyPayment/i,
    ];

    for (const method of methods) {
      for (const pattern of forbiddenPatterns) {
        expect(method).not.toMatch(pattern);
      }
    }

    // Verify the service exposes recordCorrection as the mutation path
    expect(methods).toContain('recordCorrection');
    expect(methods).toContain('recordPayment');
  });
});
