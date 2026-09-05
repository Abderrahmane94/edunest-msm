import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchReconciliationReport } from './useReconciliation';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;

describe('fetchReconciliationReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the reconciliation endpoint with startDate/endDate query params', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        branchId: 'branch-1',
        rangeStart: '2026-08-01',
        rangeEnd: '2026-08-31',
        channels: {
          cash: { total: '100.00', paymentCount: 1, correctionCount: 0 },
          ccp: { total: '0.00', paymentCount: 0, correctionCount: 0 },
          baridimob: { total: '0.00', paymentCount: 0, correctionCount: 0 },
        },
        grandTotal: '100.00',
      },
    });

    await fetchReconciliationReport('branch-1', '2026-08-01', '2026-08-31');

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [requestedUrl] = mockGet.mock.calls[0];

    // Regression guard: the backend controller (payments.controller.ts) requires
    // `startDate`/`endDate` and 400s on anything else, including the previous
    // `rangeStart`/`rangeEnd` names this hook used to send.
    const query = new URLSearchParams(requestedUrl.split('?')[1]);
    expect(query.get('startDate')).toBe('2026-08-01');
    expect(query.get('endDate')).toBe('2026-08-31');
    expect(query.has('rangeStart')).toBe(false);
    expect(query.has('rangeEnd')).toBe(false);
    expect(requestedUrl).toContain('/payments/branches/branch-1/reconciliation');
  });

  it('maps a successful response into a ReconciliationReport', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        branchId: 'branch-1',
        rangeStart: '2026-08-01',
        rangeEnd: '2026-08-31',
        channels: {
          cash: { total: '250.50', paymentCount: 3, correctionCount: 1 },
          ccp: { total: '0.00', paymentCount: 0, correctionCount: 0 },
          baridimob: { total: '10.00', paymentCount: 1, correctionCount: 0 },
        },
        grandTotal: '260.50',
      },
    });

    const report = await fetchReconciliationReport('branch-1', '2026-08-01', '2026-08-31');

    expect(report).toEqual({
      branchId: 'branch-1',
      rangeStart: '2026-08-01',
      rangeEnd: '2026-08-31',
      channels: {
        cash: { total: '250.50', paymentCount: 3, correctionCount: 1 },
        ccp: { total: '0.00', paymentCount: 0, correctionCount: 0 },
        baridimob: { total: '10.00', paymentCount: 1, correctionCount: 0 },
      },
      grandTotal: '260.50',
    });
  });

  it('throws with the backend error message when the request fails', async () => {
    mockGet.mockResolvedValue({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Both startDate and endDate query parameters are required' },
    });

    await expect(
      fetchReconciliationReport('branch-1', '2026-08-01', '2026-08-31')
    ).rejects.toThrow('Both startDate and endDate query parameters are required');
  });
});
