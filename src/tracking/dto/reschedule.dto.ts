import { IsDateString } from 'class-validator';

export class RescheduleDto {
  @IsDateString(
    { strict: true },
    { message: 'newDate must be a valid date in YYYY-MM-DD format' },
  )
  newDate: string;
}
