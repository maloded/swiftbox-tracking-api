import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { normalizeTrackingNumber } from './utils/otp.util';
import { toSpokenDate } from './utils/spoken-date';

// Public response shape expected by the Hanc.ai Tool-node
const trackingSelect = {
  trackingNumber: true,
  customerName: true,
  status: true,
  eta: true,
  address: true,
} as const;

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(trackingNumber: string) {
    const tracking = await this.prisma.tracking.findUnique({
      where: { trackingNumber },
      select: trackingSelect,
    });
    if (!tracking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tracking number not found',
      });
    }
    return { ...tracking, eta_spoken: toSpokenDate(tracking.eta) };
  }

  private async assertVerifyToken(
    trackingNumber: string,
    verifyToken?: string,
  ) {
    if (!verifyToken) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Verification required',
      });
    }
    const normalized = normalizeTrackingNumber(trackingNumber);
    const challenge = await this.prisma.otpChallenge.findUnique({
      where: { verifyToken },
    });
    const now = new Date();
    if (
      !challenge ||
      challenge.trackingNumber !== normalized ||
      !challenge.verifyExpiresAt ||
      challenge.verifyExpiresAt <= now
    ) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Verification required',
      });
    }
  }

  async reschedule(
    trackingNumber: string,
    newDate: string,
    verifyToken?: string,
  ) {
    // 404 for an unknown tracking number must stay reachable: a challenge
    // can never exist for a trackingNumber that otp/send itself 404s on,
    // so existence has to be checked before the token.
    const tracking = await this.findOne(trackingNumber);
    await this.assertVerifyToken(trackingNumber, verifyToken);
    if (tracking.status !== 'in_transit') {
      throw new BadRequestException({
        statusCode: 400,
        message: `Cannot reschedule a package with status '${tracking.status}'`,
      });
    }
    const updated = await this.prisma.tracking.update({
      where: { trackingNumber },
      data: { eta: newDate },
      select: trackingSelect,
    });
    return { ...updated, eta_spoken: toSpokenDate(updated.eta) };
  }

  async createComplaint(trackingNumber: string, dto: CreateComplaintDto) {
    const tracking = await this.prisma.tracking.findUnique({
      where: { trackingNumber },
      select: { trackingNumber: true },
    });
    if (!tracking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tracking number not found',
      });
    }
    await this.assertVerifyToken(trackingNumber, dto.verifyToken);
    const [complaint] = await this.prisma.$transaction([
      this.prisma.complaint.create({
        data: { trackingNumber, type: dto.type, details: dto.details },
      }),
      this.prisma.tracking.updateMany({
        where: { trackingNumber },
        data: { status: 'problem' },
      }),
    ]);
    return complaint;
  }
}
