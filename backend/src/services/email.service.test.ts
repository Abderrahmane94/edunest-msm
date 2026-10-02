import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReceiptData } from '../modules/payments/receipt.service';

function buildReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    language: 'fr',
    direction: 'ltr',
    labels: {
      receiptTitle: 'Reçu de paiement',
      correctionReceiptTitle: 'Reçu de correction',
      schoolName: "Nom de l'école",
      branchName: 'Nom de la branche',
      receiptNumber: 'N° de reçu',
      childName: "Nom de l'enfant",
      amount: 'Montant',
      channel: 'Canal',
      valueDate: 'Date de valeur',
      recordedBy: 'Enregistré par',
      allocatedPeriods: 'Frais payés',
      feeName: 'Frais',
      periodLabel: 'Période',
      periodAmount: 'Montant',
      correctionMarker: 'Corrigé',
      correctionReason: 'Motif',
      correctsReceipt: 'Corrige le reçu',
      correctionRecord: 'Correction',
      currency: 'DZD',
      channelCash: 'Espèces',
      channelCcp: 'CCP',
      channelBaridimob: 'BaridiMob',
      direction: 'ltr',
    },
    title: 'Reçu de paiement',
    schoolName: 'Maternelle An-Nour',
    branchName: 'Maternelle An-Nour',
    receiptNumber: 'MAI-2026-000012',
    childName: 'Yasmine Boudiaf',
    amount: '7000.00 DZD',
    channel: 'Espèces',
    channelRaw: 'cash',
    valueDate: '2026-10-02',
    recordedBy: 'Nadia Benmansour',
    allocations: [
      { feeName: 'Frais de scolarité', periodLabel: '10/2026', amount: '5000.00 DZD', periodStart: new Date('2026-10-01') },
      { feeName: "Frais d'inscription", periodLabel: "Frais d'inscription", amount: '2000.00 DZD', periodStart: new Date('2026-09-01') },
    ],
    isCorrepted: false,
    correctionMarker: null,
    corrections: [],
    isCorrection: false,
    correctionReason: null,
    correctsReceiptNumber: null,
    ...overrides,
  };
}

describe('EmailService.sendReceiptEmail', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    fetchMock.mockReset().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function sendAndGetPayload(receipt: ReceiptData) {
    const { emailService } = await import('./email.service');
    await emailService.sendReceiptEmail('parent@example.dz', receipt);
    return JSON.parse(fetchMock.mock.calls[0][1].body as string) as { to: string; subject: string; html: string };
  }

  it('sends every paid fee with its period, amount and the total', async () => {
    const payload = await sendAndGetPayload(buildReceipt());

    expect(payload.to).toBe('parent@example.dz');
    expect(payload.subject).toBe('Reçu de paiement MAI-2026-000012 — Yasmine Boudiaf');
    expect(payload.html).toContain('Frais de scolarité');
    expect(payload.html).toContain('10/2026');
    expect(payload.html).toContain('5000.00 DZD');
    expect(payload.html).toContain('7000.00 DZD');
    expect(payload.html).toContain('dir="ltr"');
  });

  it('escapes user-provided text in the email body', async () => {
    const payload = await sendAndGetPayload(buildReceipt({ childName: '<b>Yasmine</b>', schoolName: 'A & B' }));

    expect(payload.html).toContain('&lt;b&gt;Yasmine&lt;/b&gt;');
    expect(payload.html).toContain('A &amp; B');
    expect(payload.html).not.toContain('<b>Yasmine</b>');
  });

  it('attaches the receipt PDF when given', async () => {
    const { emailService } = await import('./email.service');
    await emailService.sendReceiptEmail('parent@example.dz', buildReceipt(), {
      filename: 'Reçu MAI-2026-000012 - Yasmine Boudiaf.pdf',
      content: 'JVBERi0xLjcK',
    });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      attachments?: { filename: string; content: string }[];
    };

    expect(payload.attachments).toEqual([
      { filename: 'Reçu MAI-2026-000012 - Yasmine Boudiaf.pdf', content: 'JVBERi0xLjcK' },
    ]);
  });

  it('sends no attachments field without a PDF', async () => {
    const payload = await sendAndGetPayload(buildReceipt());

    expect(payload).not.toHaveProperty('attachments');
  });

  it('lays the receipt out right-to-left in Arabic', async () => {
    const payload = await sendAndGetPayload(buildReceipt({ language: 'ar', direction: 'rtl' }));

    expect(payload.html).toContain('dir="rtl"');
    expect(payload.html).toContain('text-align:right');
  });
});
