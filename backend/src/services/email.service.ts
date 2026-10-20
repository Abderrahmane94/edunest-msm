import { isDemoEmail } from '../lib/demo';
/**
 * Email service using Resend.
 * In development mode, emails are logged to console instead of being sent.
 * Configure RESEND_API_KEY environment variable for production use.
 */

import type { ReceiptData } from '../modules/payments/receipt.service';
import type { StatementDocument } from '../modules/payments/statement.service';

/** Escapes text interpolated into email HTML (names and labels come from user data). */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

interface EmailAttachment {
  filename: string;
  /** Base64-encoded file content. */
  content: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

class EmailService {
  private apiKey: string | undefined;
  private isDevelopment: boolean;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private async send(options: SendEmailOptions): Promise<void> {
    // A demonstration's fictitious accounts: their addresses can never receive mail.
    if (isDemoEmail(options.to)) return;
    if (this.isDevelopment || !this.apiKey) {
      console.log('[EmailService] Development mode - email not sent:');
      console.log(`  To: ${options.to}`);
      console.log(`  Subject: ${options.subject}`);
      if (options.attachments?.length) {
        console.log(`  Attachments: ${options.attachments.map((a) => a.filename).join(', ')}`);
      }
      console.log(`  Body: ${options.html}`);
      return;
    }

    // Production: send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        // EMAIL_FROM is an address on a domain verified in Resend. Without it,
        // Resend's shared sandbox sender, which only delivers to the Resend
        // account's own signup email.
        from: process.env.EMAIL_FROM || 'Kiddoo <onboarding@resend.dev>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        ...(options.attachments?.length ? { attachments: options.attachments } : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[EmailService] Failed to send email:', errorBody);
      throw new Error(`Failed to send email: ${response.status}`);
    }
  }

  /** Password reset link, in Arabic then French (the same link in both). */
  async sendPasswordResetEmail(
    to: string,
    options: {
      firstName: string;
      resetUrl: string;
      expiresInHours: number;
      /** Set when the email has accounts in several schools. */
      schoolName?: string | null;
      /** The email has several accounts, and this link is for the platform's own (a super admin's). */
      platformAccount?: boolean;
    },
  ): Promise<void> {
    const e = escapeHtml;
    const hours = options.expiresInHours;
    const school = options.schoolName ? e(options.schoolName) : null;
    const platform = !school && options.platformAccount === true;
    // Several accounts: one email each, and each says this link changes only its own.
    const several = school !== null || platform;
    const url = e(options.resetUrl);

    const sections = [
      {
        dir: 'rtl',
        align: 'right',
        lang: 'ar',
        title: 'إعادة تعيين كلمة المرور',
        hello: `مرحبًا ${e(options.firstName)}،`,
        intro: school
          ? `طلبت إعادة تعيين كلمة مرور حسابك في Kiddoo لدى <strong>${school}</strong>.`
          : platform
            ? 'طلبت إعادة تعيين كلمة مرور حسابك في <strong>منصة Kiddoo</strong> (الإدارة العامة).'
            : 'طلبت إعادة تعيين كلمة مرور حسابك في Kiddoo.',
        several: 'لهذا العنوان عدة حسابات: تصلك رسالة لكل حساب، وهذا الرابط لا يغيّر إلا كلمة مرور هذا الحساب.',
        action: 'اختيار كلمة مرور جديدة',
        expiry:
          hours === 1
            ? 'هذا الرابط صالح لمدة ساعة واحدة ولا يُستعمل إلا مرة واحدة.'
            : `هذا الرابط صالح لمدة ${hours} ساعات ولا يُستعمل إلا مرة واحدة.`,
        ignore: 'إذا لم تطلب ذلك، تجاهل هذه الرسالة: كلمة مرورك لن تتغير.',
        team: '— فريق Kiddoo',
      },
      {
        dir: 'ltr',
        align: 'left',
        lang: 'fr',
        title: 'Réinitialisation du mot de passe',
        hello: `Bonjour ${e(options.firstName)},`,
        intro: school
          ? `Vous avez demandé à réinitialiser le mot de passe de votre compte Kiddoo chez <strong>${school}</strong>.`
          : platform
            ? 'Vous avez demandé à réinitialiser le mot de passe de votre compte de la <strong>plateforme Kiddoo</strong> (super administrateur).'
            : 'Vous avez demandé à réinitialiser le mot de passe de votre compte Kiddoo.',
        several: "Cette adresse a plusieurs comptes : vous recevez un e-mail par compte, et ce lien ne change que le mot de passe de celui-ci.",
        action: 'Choisir un nouveau mot de passe',
        expiry: `Ce lien est valable ${hours} heure${hours > 1 ? 's' : ''} et ne peut servir qu'une fois.`,
        ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe ne changera pas.",
        team: "— L'équipe Kiddoo",
      },
    ];

    const html = sections
      .map(
        (t) => `
        <div dir="${t.dir}" lang="${t.lang}" style="text-align:${t.align};">
          <h2 style="margin:0 0 16px;">${t.title}</h2>
          <p>${t.hello}</p>
          <p>${t.intro}</p>
          ${several ? `<p style="color:#6B7280;font-size:13px;">${t.several}</p>` : ''}
          <p style="margin:24px 0;">
            <a href="${url}" style="background:#4F46E5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;">${t.action}</a>
          </p>
          <p style="color:#6B7280;font-size:13px;">${t.expiry}</p>
          <p style="color:#6B7280;font-size:13px;">${t.ignore}</p>
          <p>${t.team}</p>
        </div>`,
      )
      .join('<hr style="border:none;border-top:1px solid #E5E7EB;margin:28px 0;" />');

    await this.send({
      to,
      // Several accounts: the subjects tell the emails apart in the inbox.
      subject: `Kiddoo - إعادة تعيين كلمة المرور / Réinitialisation du mot de passe${
        options.schoolName ? ` — ${options.schoolName}` : platform ? ' — Plateforme Kiddoo' : ''
      }`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:520px;">${html}</div>`,
    });
  }

  async sendInvitationEmail(
    to: string,
    invitationUrl: string,
    schoolName: string,
    role: string
  ): Promise<void> {
    await this.send({
      to,
      subject: `Kiddoo - You've been invited to ${schoolName}`,
      html: `
        <h2>Welcome to Kiddoo</h2>
        <p>You have been invited to join <strong>${schoolName}</strong> as a <strong>${role}</strong>.</p>
        <p>Click the link below to complete your registration:</p>
        <p><a href="${invitationUrl}">Accept Invitation</a></p>
        <br/>
        <p>— The Kiddoo Team</p>
      `,
    });
  }

  /**
   * Sends a payment receipt — every fee paid, period and amount — as HTML,
   * optionally with the receipt PDF attached.
   */
  async sendReceiptEmail(to: string, receipt: ReceiptData, pdf?: EmailAttachment): Promise<void> {
    const e = escapeHtml;
    const { labels } = receipt;
    const align = receipt.direction === 'rtl' ? 'right' : 'left';
    const opposite = receipt.direction === 'rtl' ? 'left' : 'right';
    const cell = 'padding:8px 12px;border-top:1px solid #e5e7eb;';
    const field = (label: string, value: string): string =>
      `<tr><td style="padding:4px 0;color:#6b7280;">${e(label)}</td>` +
      `<td style="padding:4px 0;text-align:${opposite};font-weight:600;">${e(value)}</td></tr>`;

    const rows = receipt.allocations
      .map(
        (a) =>
          `<tr><td style="${cell}">${e(a.feeName || '—')}` +
          (a.discountNote ? `<div style="font-size:12px;color:#4f46e5;">${e(a.discountNote)}</div>` : '') +
          `</td>` +
          `<td style="${cell}color:#6b7280;" dir="ltr">${e(a.periodLabel)}</td>` +
          `<td style="${cell}text-align:${opposite};" dir="ltr">${e(a.amount)}</td></tr>`,
      )
      .join('');

    const feesTable = receipt.allocations.length
      ? `<h3 style="font-size:15px;margin:24px 0 8px;">${e(labels.allocatedPeriods)}</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;font-size:14px;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:${align};">${e(labels.feeName)}</th>
            <th style="padding:8px 12px;text-align:${align};">${e(labels.periodLabel)}</th>
            <th style="padding:8px 12px;text-align:${opposite};">${e(labels.periodAmount)}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>${
            receipt.totalDiscount
              ? `<tr style="color:#4f46e5;"><td colspan="2" style="${cell}">${e(labels.discount)}</td>` +
                `<td style="${cell}text-align:${opposite};" dir="ltr">−${e(receipt.totalDiscount)}</td></tr>`
              : ''
          }<tr style="background:#f9fafb;font-weight:700;">
            <td colspan="2" style="${cell}">${e(labels.amount)}</td>
            <td style="${cell}text-align:${opposite};" dir="ltr">${e(receipt.amount)}</td>
          </tr></tfoot>
        </table>`
      : '';

    await this.send({
      to,
      subject: `${receipt.title} ${receipt.receiptNumber} — ${receipt.childName}`,
      html: `
        <div dir="${receipt.direction}" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;text-align:${align};">
          <h2 style="text-align:center;">${e(receipt.title)}</h2>
          <p style="text-align:center;color:#6b7280;margin-top:-8px;">${e(receipt.schoolName)}</p>
          <table style="width:100%;font-size:14px;background:#f9fafb;padding:12px;border-radius:8px;">
            ${field(labels.receiptNumber, receipt.receiptNumber)}
            ${field(labels.childName, receipt.childName)}
            ${field(labels.amount, receipt.amount)}
            ${field(labels.channel, receipt.channel)}
            ${field(labels.valueDate, receipt.valueDate)}
            ${field(labels.recordedBy, receipt.recordedBy)}
          </table>
          ${feesTable}
          <p style="margin-top:24px;color:#6b7280;font-size:12px;">— ${e(receipt.schoolName)} · Kiddoo</p>
        </div>
      `,
      attachments: pdf ? [pdf] : undefined,
    });
  }

  /**
   * Sends a statement of account: the totals in the message, the statement
   * itself attached as a PDF.
   */
  async sendStatementEmail(to: string, document: StatementDocument, language: 'ar' | 'fr', pdf: EmailAttachment): Promise<void> {
    const e = escapeHtml;
    const ar = language === 'ar';
    const L = ar
      ? { title: 'كشف الحساب', year: 'السنة الدراسية', billed: 'المبلغ المفوتر', paid: 'المبلغ المدفوع', outstanding: 'الباقي للدفع', late: 'منه متأخر', attached: 'تجدون الكشف المفصل في الملف المرفق.', currency: 'د.ج' }
      : { title: 'Relevé de compte', year: 'Année scolaire', billed: 'Total facturé', paid: 'Total payé', outstanding: 'Reste à payer', late: 'dont en retard', attached: 'Le relevé détaillé est en pièce jointe.', currency: 'DZD' };
    const opposite = ar ? 'left' : 'right';
    const names = document.statements.map((s) => `${s.child.firstName} ${s.child.lastName}`).join(ar ? '، ' : ', ');
    const amount = (value: string) => `${Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${L.currency}`;
    const field = (label: string, value: string, strong = false): string =>
      `<tr><td style="padding:4px 0;color:#6b7280;">${e(label)}</td>` +
      `<td style="padding:4px 0;text-align:${opposite};font-weight:${strong ? 700 : 600};" dir="ltr">${e(value)}</td></tr>`;

    await this.send({
      to,
      subject: `${L.title} ${document.year.name} — ${names}`,
      html: `
        <div dir="${ar ? 'rtl' : 'ltr'}" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;text-align:${ar ? 'right' : 'left'};">
          <h2 style="text-align:center;">${e(L.title)}</h2>
          <p style="text-align:center;color:#6b7280;margin-top:-8px;">${e(document.school.name)}</p>
          <p style="font-weight:600;">${e(names)}</p>
          <table style="width:100%;font-size:14px;background:#f9fafb;padding:12px;border-radius:8px;">
            ${field(L.year, document.year.name)}
            ${field(L.billed, amount(document.totals.billed))}
            ${field(L.paid, amount(document.totals.paid))}
            ${field(L.outstanding, amount(document.totals.outstanding), true)}
            ${Number(document.totals.late) > 0 ? field(L.late, amount(document.totals.late)) : ''}
          </table>
          <p style="margin-top:16px;">${e(L.attached)}</p>
          <p style="margin-top:24px;color:#6b7280;font-size:12px;">— ${e(document.school.name)} · Kiddoo</p>
        </div>
      `,
      attachments: [pdf],
    });
  }

  async sendNotificationEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<void> {
    await this.send({
      to,
      subject: `Kiddoo - ${subject}`,
      html: `
        <h2>${subject}</h2>
        <p>${body}</p>
        <br/>
        <p>— The Kiddoo Team</p>
      `,
    });
  }
}

export const emailService = new EmailService();
