import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const COMPLAINT_TYPES = ['damaged', 'lost', 'wrong_item'] as const;

export class CreateComplaintDto {
  @IsIn(COMPLAINT_TYPES, {
    message: `type must be one of: ${COMPLAINT_TYPES.join(', ')}`,
  })
  type: string;

  @IsString()
  @IsNotEmpty()
  details: string;

  // Presence/validity is checked in the service so a missing token also
  // yields 401 "Verification required" instead of a generic 400.
  @IsOptional()
  @IsString()
  verifyToken: string;
}
