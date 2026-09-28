import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
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

  async reschedule(trackingNumber: string, newDate: string) {
    const tracking = await this.findOne(trackingNumber);
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
    const [complaint] = await this.prisma.$transaction([
      this.prisma.complaint.create({
        data: { trackingNumber, type: dto.type, details: dto.details },
      }),
      // updateMany doesn't throw when the tracking number is unknown
      this.prisma.tracking.updateMany({
        where: { trackingNumber },
        data: { status: 'problem' },
      }),
    ]);
    return complaint;
  }
}
