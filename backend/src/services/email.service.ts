/**
 * Email service using Resend.
 * In development mode, emails are logged to console instead of being sent.
 * Configure RESEND_API_KEY environment variable for production use.
 */

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
