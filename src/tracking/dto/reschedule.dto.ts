import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RescheduleDto {
  @IsDateString(
    { strict: true },
    { message: 'newDate must be a valid date in YYYY-MM-DD format' },
  )
  newDate: string;

  // Presence/validity is checked in the service so a missing token also
  // yields 401 "Verification required" instead of a generic 400.
  @IsOptional()
  @IsString()
  verifyToken: string;
}
