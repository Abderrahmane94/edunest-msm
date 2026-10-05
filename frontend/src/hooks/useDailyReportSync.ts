import { apiClient } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { registerQueueHandler, QueueRejectedError } from '@/lib/offlineQueue';
import type { Mood } from '@/hooks/useCommunication';

/**
 * A child's daily report for a day, as saved by the teacher: sent with
 * PUT /api/communication/daily-reports/day (create or update), then its new
 * photos. Saved on the device and sent later when there's no connection.
 */
export interface DailyReportDayPayload {
  childId: string;
  date: string;
  mood: Mood;
  mealsEaten: number;
  napDurationMinutes: number | null;
  activities: string | null;
  generalNote: string | null;
  /** When the teacher saved it (a later change made on the server wins). */
  savedAt: string;
  /** New photos, kept on the device until sent; the id stops a resend from adding them twice. */
  photos: { clientId: string; blob: Blob; name: string }[];
}

/** What a teacher should know after a report was sent from the queue. */
export interface DailyReportSyncNotice {
  childId: string;
  date: string;
  skipped: true;
}

export const DAILY_REPORT = 'daily-report';
export const dailyReportKey = (childId: string, date: string) => `daily-report:${childId}:${date}`;

/** The upload endpoint takes up to 6 photos per request. */
const PHOTOS_PER_REQUEST = 6;

function failure(res: { error?: { code?: string; message?: string } }, fallback: string): Error {
  // An expired session isn't a refusal of the report: keep it until the user
  // is signed in again.
  if (res.error?.code === 'UNAUTHORIZED') return new Error('UNAUTHORIZED');
  return new QueueRejectedError(res.error?.message || fallback);
}

/**
 * Saves the report, then uploads its photos. Safe to send again: the report is
 * updated in place and photos already received are skipped. Throws
 * QueueRejectedError when the server refuses it, a plain error when the
 * network is down.
 */
export async function sendDailyReport(payload: DailyReportDayPayload): Promise<{ reportId: string; skipped: boolean }> {
  const { photos, ...fields } = payload;
  const res = await apiClient.put<{ report: { id: string }; skipped: boolean }>(
    '/communication/daily-reports/day',
    fields,
  );
  if (!res.success || !res.data) throw failure(res, 'Failed to save report');
  const reportId = res.data.report.id;

  // Photos are added even when the report's text was left as it was.
  for (let i = 0; i < photos.length; i += PHOTOS_PER_REQUEST) {
    const formData = new FormData();
    for (const photo of photos.slice(i, i + PHOTOS_PER_REQUEST)) {
      formData.append('photos', photo.blob, photo.name);
      formData.append('clientIds', photo.clientId);
    }
    const upload = await apiClient.uploadFile(`/communication/daily-reports/${reportId}/photos`, formData);
    if (!upload.success) throw failure(upload, 'Failed to upload photos');
  }

  return { reportId, skipped: res.data.skipped };
}

registerQueueHandler<DailyReportDayPayload>(DAILY_REPORT, {
  send: async (payload): Promise<DailyReportSyncNotice | undefined> => {
    const result = await sendDailyReport(payload);
    return result.skipped ? { childId: payload.childId, date: payload.date, skipped: true } : undefined;
  },
  // The latest text wins; photos add up.
  merge: (older, newer) => ({
    ...newer,
    photos: [
      ...older.photos,
      ...newer.photos.filter((photo) => !older.photos.some((p) => p.clientId === photo.clientId)),
    ],
  }),
  onSent: (payload) => {
    void queryClient.invalidateQueries({ queryKey: ['daily-reports-for-child', payload.childId] });
    void queryClient.invalidateQueries({ queryKey: ['parent-daily-reports'] });
  },
});
