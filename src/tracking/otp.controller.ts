import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';

@Controller('tracking')
@UseGuards(ApiKeyGuard)
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post(':trackingNumber/otp/send')
  @HttpCode(200)
  send(@Param('trackingNumber') trackingNumber: string) {
    return this.otpService.send(trackingNumber);
  }

  @Post(':trackingNumber/otp/verify')
  @HttpCode(200)
  verify(
    @Param('trackingNumber') trackingNumber: string,
    @Body() dto: VerifyOtpDto,
  ) {
    return this.otpService.verify(trackingNumber, dto.code);
  }
}
