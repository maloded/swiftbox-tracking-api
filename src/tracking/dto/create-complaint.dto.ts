import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export const COMPLAINT_TYPES = ['damaged', 'lost', 'wrong_item'] as const;

export class CreateComplaintDto {
  @IsIn(COMPLAINT_TYPES, {
    message: `type must be one of: ${COMPLAINT_TYPES.join(', ')}`,
  })
  type: string;

  @IsString()
  @IsNotEmpty()
  details: string;
}
