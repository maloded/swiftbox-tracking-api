import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  controllers: [TrackingController, OtpController],
  providers: [TrackingService, OtpService, MailerService],
})
export class TrackingModule {}
