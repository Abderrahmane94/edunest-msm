/**
 * Email service using Resend.
 * In development mode, emails are logged to console instead of being sent.
 * Configure RESEND_API_KEY environment variable for production use.
 */

import type { ReceiptData } from '../modules/payments/receipt.service';

/** Escapes text interpolated into email HTML (names and labels come from user data). */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private apiKey: string | undefined;
  private isDevelopment: boolean;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private async send(options: SendEmailOptions): Promise<void> {
    if (this.isDevelopment || !this.apiKey) {
      console.log('[EmailService] Development mode - email not sent:');
      console.log(`  To: ${options.to}`);
      console.log(`  Subject: ${options.subject}`);
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
        // Resend's shared sandbox sender — works without owning/verifying a
        // domain, but can only deliver to the Resend account's own signup
        // email until a real domain is verified. Switch this to a verified
        // domain address once one is available.
        from: 'EduNest <onboarding@resend.dev>',
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[EmailService] Failed to send email:', errorBody);
      throw new Error(`Failed to send email: ${response.status}`);
    }
  }

  async sendPasswordResetEmail(
    to: string,
    firstName: string,
    resetUrl: string
  ): Promise<void> {
    await this.send({
      to,
      subject: 'EduNest - Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>Hello ${firstName},</p>
        <p>You requested a password reset for your EduNest account.</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>If you did not request this reset, please ignore this email.</p>
        <br/>
        <p>— The EduNest Team</p>
      `,
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
      subject: `EduNest - You've been invited to ${schoolName}`,
      html: `
        <h2>Welcome to EduNest</h2>
        <p>You have been invited to join <strong>${schoolName}</strong> as a <strong>${role}</strong>.</p>
        <p>Click the link below to complete your registration:</p>
        <p><a href="${invitationUrl}">Accept Invitation</a></p>
        <br/>
        <p>— The EduNest Team</p>
      `,
    });
  }

  /** Sends a payment receipt — every fee paid, period and amount — as HTML. */
  async sendReceiptEmail(to: string, receipt: ReceiptData): Promise<void> {
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
          `<tr><td style="${cell}">${e(a.feeName || '—')}</td>` +
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
          <tfoot><tr style="background:#f9fafb;font-weight:700;">
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
          <p style="margin-top:24px;color:#6b7280;font-size:12px;">— ${e(receipt.schoolName)} · EduNest</p>
        </div>
      `,
    });
  }

  async sendNotificationEmail(
    to: string,
    subject: string,
    body: string
  ): Promise<void> {
    await this.send({
      to,
      subject: `EduNest - ${subject}`,
      html: `
        <h2>${subject}</h2>
        <p>${body}</p>
        <br/>
        <p>— The EduNest Team</p>
      `,
    });
  }
}

export const emailService = new EmailService();
