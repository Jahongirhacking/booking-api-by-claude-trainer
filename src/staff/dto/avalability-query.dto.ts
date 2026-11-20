import { IsString, IsUUID } from 'class-validator';

export class AvalabilityQueryDto {
  @IsString()
  date!: string;

  @IsUUID()
  serviceId!: string;
}
