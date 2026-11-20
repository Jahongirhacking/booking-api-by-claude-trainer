import { IsString, IsUUID } from 'class-validator';

export class CreateStaffDto {
  @IsUUID()
  userId!: string;

  @IsString()
  specialization!: string;
}
