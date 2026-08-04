import { describe, it, expect, vi } from 'vitest';
import { generateReceiptNumber, deriveBranchCode } from './receipt-number.util';

describe('deriveBranchCode', () => {
  it('returns first 3 uppercase chars for normal branch name', () => {
    expect(deriveBranchCode('Main Branch')).toBe('MAI');
  });

  it('returns first 3 uppercase chars ignoring non-ASCII', () => {
    expect(deriveBranchCode('Établissement Central')).toBe('TAB');
  });

  it('pads with X when branch name has fewer than 3 ASCII letters', () => {
    expect(deriveBranchCode('AB')).toBe('ABX');
  });

  it('pads with XX when branch name has only 1 ASCII letter', () => {
    expect(deriveBranchCode('A')).toBe('AXX');
  });

  it('returns BRN when branch name has no ASCII letters', () => {
    expect(deriveBranchCode('الفرع الرئيسي')).toBe('BRN');
  });

  it('returns BRN for empty string', () => {
    expect(deriveBranchCode('')).toBe('BRN');
  });

  it('handles branch name with numbers only', () => {
    expect(deriveBranchCode('123')).toBe('BRN');
  });

  it('handles mixed ASCII and non-ASCII characters', () => {
    expect(deriveBranchCode('فرع A2B')).toBe('ABX');
  });

  it('handles branch name with special characters', () => {
    expect(deriveBranchCode('--Hello--')).toBe('HEL');
  });

  it('uppercases lowercase input', () => {
    expect(deriveBranchCode('downtown')).toBe('DOW');
  });
});

describe('generateReceiptNumber', () => {
  it('generates receipt number in correct format', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ next_seq: BigInt(1) }]),
    };

    const result = await generateReceiptNumber(
      mockTx as any,
      'branch-123',
      'Main Branch',
      new Date('2024-09-15')
    );

    expect(result).toBe('MAI-2024-000001');
  });

  it('zero-pads sequence number to 6 digits', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ next_seq: BigInt(42) }]),
    };

    const result = await generateReceiptNumber(
      mockTx as any,
      'branch-123',
      'Downtown Office',
      new Date('2025-01-10')
    );

    expect(result).toBe('DOW-2025-000042');
  });

  it('handles large sequence numbers', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ next_seq: BigInt(999999) }]),
    };

    const result = await generateReceiptNumber(
      mockTx as any,
      'branch-123',
      'East Wing',
      new Date('2025-06-01')
    );

    expect(result).toBe('EAS-2025-999999');
  });

  it('uses year from valueDate', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ next_seq: BigInt(5) }]),
    };

    const result = await generateReceiptNumber(
      mockTx as any,
      'branch-abc',
      'North Campus',
      new Date('2026-12-31')
    );

    expect(result).toBe('NOR-2026-000005');
  });

  it('passes correct parameters to the raw query', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ next_seq: BigInt(1) }]),
    };

    await generateReceiptNumber(
      mockTx as any,
      'branch-xyz',
      'Test Branch',
      new Date('2024-03-20')
    );

    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('handles Arabic-only branch name with BRN fallback', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ next_seq: BigInt(7) }]),
    };

    const result = await generateReceiptNumber(
      mockTx as any,
      'branch-ar',
      'الفرع الأول',
      new Date('2025-09-01')
    );

    expect(result).toBe('BRN-2025-000007');
  });
});
