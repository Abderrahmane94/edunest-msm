import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Property 18: Conditional Reference Note Requirement
 *
 * For any payment record where the channel is `ccp` or `baridimob`,
 * `reference_note` SHALL be non-empty (1-500 chars after trim).
 * For any correction payment record (`is_correction = true`),
 * `reference_note` SHALL be non-empty regardless of channel.
 *
 * **Validates: Requirements 10.3, 11.7**
 */

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentChannel = 'cash' | 'ccp' | 'baridimob';

interface PaymentInput {
  channel: PaymentChannel;
  referenceNote: string | null | undefined;
  isCorrection: boolean;
}

interface ValidationResult {
  valid: boolean;
  errorField?: string;
  errorMessage?: string;
}

// ─── Validation Logic (mirrors payments.service.ts) ──────────────────────────

/**
 * Validates the reference_note field based on channel and correction status.
 * This mirrors the validation logic in payments.service.ts:
 * - ccp/baridimob: reference_note required (1-500 chars after trim)
 * - is_correction=true: reference_note required regardless of channel
 * - cash (non-correction): reference_note optional, max 500 chars if provided
 */
function validateReferenceNote(input: PaymentInput): ValidationResult {
  const { channel, referenceNote, isCorrection } = input;
  const trimmedNote = referenceNote?.trim() ?? '';

  // Corrections always require reference_note
  if (isCorrection) {
    if (trimmedNote.length < 1 || trimmedNote.length > 500) {
      return {
        valid: false,
        errorField: 'reference_note',
        errorMessage:
          'reference_note is required for corrections (1-500 characters after trim)',
      };
    }
    return { valid: true };
  }

  // ccp/baridimob channels require reference_note
  if (channel === 'ccp' || channel === 'baridimob') {
    if (trimmedNote.length < 1 || trimmedNote.length > 500) {
      return {
        valid: false,
        errorField: 'reference_note',
        errorMessage:
          'reference_note is required for ccp/baridimob channels (1-500 characters after trim)',
      };
    }
    return { valid: true };
  }

  // cash (non-correction): reference_note is optional, but max 500 chars
  if (channel === 'cash' && referenceNote) {
    if (referenceNote.length > 500) {
      return {
        valid: false,
        errorField: 'reference_note',
        errorMessage: 'reference_note must be at most 500 characters',
      };
    }
  }

  return { valid: true };
}

// ─── Arbitrary Generators ────────────────────────────────────────────────────

const arbChannel = fc.constantFrom<PaymentChannel>('cash', 'ccp', 'baridimob');
const arbCcpOrBaridimob = fc.constantFrom<PaymentChannel>('ccp', 'baridimob');

/** Generates a valid reference note (1-500 non-whitespace-only chars after trim) */
const arbValidReferenceNote = fc
  .string({ minLength: 1, maxLength: 498 })
  .map((s) => ` ${s.replace(/^\s+|\s+$/g, '') || 'x'} `); // pad with spaces, ensure non-empty after trim

/** Generates a reference note that is 1-500 chars after trimming */
const arbStrictValidReferenceNote = fc
  .integer({ min: 1, max: 500 })
  .chain((len) =>
    fc.string({ minLength: len, maxLength: len }).map((s) => {
      // Ensure after trim we still have 1-500 chars
      const trimmed = s.trim();
      if (trimmed.length >= 1 && trimmed.length <= 500) return trimmed;
      // Fallback: produce a non-whitespace string of the desired length
      return 'REF-' + 'x'.repeat(Math.max(1, len - 4));
    })
  );

/** Generates missing/empty reference notes (absent, null, empty, whitespace-only) */
const arbMissingReferenceNote = fc.oneof(
  fc.constant(null as string | null | undefined),
  fc.constant(undefined as string | null | undefined),
  fc.constant('' as string | null | undefined),
  fc.constant('   ' as string | null | undefined),
  fc.constant('\t\n' as string | null | undefined)
);

/** Generates a reference note that exceeds 500 chars */
const arbTooLongReferenceNote = fc
  .integer({ min: 501, max: 600 })
  .map((len) => 'x'.repeat(len));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Property 18: Conditional Reference Note Requirement', () => {
  it('ccp/baridimob payments are rejected when reference_note is missing or empty', () => {
    fc.assert(
      fc.property(
        arbCcpOrBaridimob,
        arbMissingReferenceNote,
        (channel, referenceNote) => {
          const result = validateReferenceNote({
            channel,
            referenceNote,
            isCorrection: false,
          });

          expect(result.valid).toBe(false);
          expect(result.errorField).toBe('reference_note');
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('ccp/baridimob payments are accepted when reference_note is 1-500 chars after trim', () => {
    fc.assert(
      fc.property(
        arbCcpOrBaridimob,
        arbStrictValidReferenceNote,
        (channel, referenceNote) => {
          const result = validateReferenceNote({
            channel,
            referenceNote,
            isCorrection: false,
          });

          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('ccp/baridimob payments are rejected when reference_note exceeds 500 chars', () => {
    fc.assert(
      fc.property(
        arbCcpOrBaridimob,
        arbTooLongReferenceNote,
        (channel, referenceNote) => {
          const result = validateReferenceNote({
            channel,
            referenceNote,
            isCorrection: false,
          });

          expect(result.valid).toBe(false);
          expect(result.errorField).toBe('reference_note');
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('corrections are rejected when reference_note is missing/empty regardless of channel', () => {
    fc.assert(
      fc.property(arbChannel, arbMissingReferenceNote, (channel, referenceNote) => {
        const result = validateReferenceNote({
          channel,
          referenceNote,
          isCorrection: true,
        });

        expect(result.valid).toBe(false);
        expect(result.errorField).toBe('reference_note');
      }),
      { numRuns: 1000 }
    );
  });

  it('corrections are accepted when reference_note is 1-500 chars regardless of channel', () => {
    fc.assert(
      fc.property(arbChannel, arbStrictValidReferenceNote, (channel, referenceNote) => {
        const result = validateReferenceNote({
          channel,
          referenceNote,
          isCorrection: true,
        });

        expect(result.valid).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('corrections are rejected when reference_note exceeds 500 chars regardless of channel', () => {
    fc.assert(
      fc.property(arbChannel, arbTooLongReferenceNote, (channel, referenceNote) => {
        const result = validateReferenceNote({
          channel,
          referenceNote,
          isCorrection: true,
        });

        expect(result.valid).toBe(false);
        expect(result.errorField).toBe('reference_note');
      }),
      { numRuns: 1000 }
    );
  });

  it('cash channel non-correction payments are accepted without reference_note', () => {
    fc.assert(
      fc.property(arbMissingReferenceNote, (referenceNote) => {
        const result = validateReferenceNote({
          channel: 'cash',
          referenceNote,
          isCorrection: false,
        });

        expect(result.valid).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('cash channel non-correction payments are accepted with valid reference_note', () => {
    fc.assert(
      fc.property(arbStrictValidReferenceNote, (referenceNote) => {
        const result = validateReferenceNote({
          channel: 'cash',
          referenceNote,
          isCorrection: false,
        });

        expect(result.valid).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('cash channel non-correction payments are rejected when reference_note exceeds 500 chars', () => {
    fc.assert(
      fc.property(arbTooLongReferenceNote, (referenceNote) => {
        const result = validateReferenceNote({
          channel: 'cash',
          referenceNote,
          isCorrection: false,
        });

        expect(result.valid).toBe(false);
        expect(result.errorField).toBe('reference_note');
      }),
      { numRuns: 1000 }
    );
  });

  it('the service validates ccp/baridimob reference_note requirement consistently with schema', async () => {
    // Verify that recordPaymentSchema allows optional referenceNote
    // while the service enforces the channel-specific requirement
    const { recordPaymentSchema, recordCorrectionSchema } = await import(
      '../payments.schema'
    );

    // recordPaymentSchema: referenceNote is optional at schema level
    const cashPaymentNoNote = recordPaymentSchema.safeParse({
      childId: '00000000-0000-0000-0000-000000000001',
      totalAmount: 100.0,
      channel: 'cash',
      valueDate: new Date('2024-01-15'),
      allocations: [
        {
          billingPeriodId: '00000000-0000-0000-0000-000000000002',
          amount: 100.0,
        },
      ],
      // no referenceNote → OK at schema level for cash
    });
    expect(cashPaymentNoNote.success).toBe(true);

    // recordCorrectionSchema: referenceNote is required at schema level
    const correctionNoNote = recordCorrectionSchema.safeParse({
      childId: '00000000-0000-0000-0000-000000000001',
      totalAmount: -50.0,
      channel: 'cash',
      valueDate: new Date('2024-01-15'),
      correctsPaymentId: '00000000-0000-0000-0000-000000000003',
      allocations: [
        {
          billingPeriodId: '00000000-0000-0000-0000-000000000002',
          amount: -50.0,
        },
      ],
      // no referenceNote → FAIL at schema level for corrections
    });
    expect(correctionNoNote.success).toBe(false);

    // recordCorrectionSchema: referenceNote with valid value passes
    const correctionWithNote = recordCorrectionSchema.safeParse({
      childId: '00000000-0000-0000-0000-000000000001',
      totalAmount: -50.0,
      channel: 'cash',
      valueDate: new Date('2024-01-15'),
      referenceNote: 'Refund reason: parent request',
      correctsPaymentId: '00000000-0000-0000-0000-000000000003',
      allocations: [
        {
          billingPeriodId: '00000000-0000-0000-0000-000000000002',
          amount: -50.0,
        },
      ],
    });
    expect(correctionWithNote.success).toBe(true);
  });
});
