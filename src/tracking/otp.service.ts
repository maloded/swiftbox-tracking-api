import {
  BadGatewayException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';
import {
  generateOtpCode,
  generateVerifyToken,
  hashOtpCode,
  isValidOtpFormat,
  maskEmail,
  normalizeOtpInput,
  normalizeTrackingNumber,
  otpHashesMatch,
} from './utils/otp.util';

const MAX_ATTEMPTS = 3;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  private get cooldownMs(): number {
    return Number(process.env.OTP_COOLDOWN_MS ?? 60_000);
  }

  private get ttlMs(): number {
    return Number(process.env.OTP_TTL_MS ?? 10 * 60_000);
  }

  private get verifyTtlMs(): number {
    return Number(process.env.OTP_VERIFY_TTL_MS ?? 15 * 60_000);
  }

  private get secret(): string {
    const secret = process.env.OTP_SECRET;
    if (!secret) {
      throw new Error('OTP_SECRET is not set');
    }
    return secret;
  }

  async send(trackingNumberRaw: string) {
    const trackingNumber = normalizeTrackingNumber(trackingNumberRaw);

    const tracking = await this.prisma.tracking.findUnique({
      where: { trackingNumber },
      select: { trackingNumber: true, customerEmail: true },
    });
    if (!tracking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tracking number not found',
      });
    }
    if (!tracking.customerEmail) {
      throw new ConflictException({
        statusCode: 409,
        message: 'No email on file',
      });
    }

    const lastChallenge = await this.prisma.otpChallenge.findFirst({
      where: { trackingNumber },
      orderBy: { createdAt: 'desc' },
    });
    if (
      lastChallenge &&
      Date.now() - lastChallenge.createdAt.getTime() < this.cooldownMs
    ) {
      throw new HttpException(
        {
          statusCode: 429,
          message: 'Please wait before requesting a new code',
        },
        429,
      );
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(code, this.secret);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);

    try {
      await this.mailer.sendOtpCode(tracking.customerEmail, code);
    } catch {
      throw new BadGatewayException({
        statusCode: 502,
        message: 'Could not send the code',
      });
    }

    // Only invalidate old challenges / persist the new one once the email
    // has actually gone out, so a failed send doesn't kill a still-good
    // previous code or leave a dangling undelivered one behind.
    await this.prisma.$transaction([
      this.prisma.otpChallenge.updateMany({
        where: { trackingNumber, consumedAt: null },
        data: { consumedAt: now },
      }),
      this.prisma.otpChallenge.create({
        data: { trackingNumber, codeHash, expiresAt },
      }),
    ]);

    return { otpSent: true, maskedEmail: maskEmail(tracking.customerEmail) };
  }

  async verify(trackingNumberRaw: string, rawCode: string) {
    const trackingNumber = normalizeTrackingNumber(trackingNumberRaw);
    const now = new Date();

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        trackingNumber,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Code expired or not requested',
        otpVerified: false,
      });
    }

    const digits = normalizeOtpInput(rawCode);
    const matches =
      isValidOtpFormat(digits) &&
      otpHashesMatch(hashOtpCode(digits, this.secret), challenge.codeHash);

    if (!matches) {
      const attempts = challenge.attempts + 1;
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts },
      });
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid code',
        otpVerified: false,
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts),
      });
    }

    const verifyToken = generateVerifyToken();
    const verifyExpiresAt = new Date(now.getTime() + this.verifyTtlMs);
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now, verifyToken, verifyExpiresAt },
    });

    return { otpVerified: true, verifyToken };
  }
}
