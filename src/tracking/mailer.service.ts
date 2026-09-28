import { Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendOtpCode(to: string, code: string): Promise<void> {
    const transporter = createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject: 'Your SwiftBox verification code',
        text: `Your verification code is ${code}. It is valid for 10 minutes. If you did not request this, ignore this email.`,
      });
    } catch (err) {
      // Never log the code or SMTP credentials — only the transport-level error.
      this.logger.error(
        `Failed to send OTP email: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      throw err;
    }
  }
}
