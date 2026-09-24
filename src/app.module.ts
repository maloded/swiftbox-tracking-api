import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [PrismaModule, TrackingModule],
  controllers: [HealthController],
})
export class AppModule {}
