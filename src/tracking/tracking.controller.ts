import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { RescheduleDto } from './dto/reschedule.dto';
import { TrackingService } from './tracking.service';

@Controller('tracking')
@UseGuards(ApiKeyGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get(':trackingNumber')
  findOne(@Param('trackingNumber') trackingNumber: string) {
    return this.trackingService.findOne(trackingNumber);
  }

  @Patch(':trackingNumber/reschedule')
  reschedule(
    @Param('trackingNumber') trackingNumber: string,
    @Body() dto: RescheduleDto,
  ) {
    return this.trackingService.reschedule(
      trackingNumber,
      dto.newDate,
      dto.verifyToken,
    );
  }

  @Post(':trackingNumber/complaint')
  createComplaint(
    @Param('trackingNumber') trackingNumber: string,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.trackingService.createComplaint(trackingNumber, dto);
  }
}
