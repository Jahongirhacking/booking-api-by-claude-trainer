import { Transform } from 'class-transformer';
import { IsNumber, IsString, Length, Max, Min } from 'class-validator';

export class CreateServiceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  description?: string;

  @IsNumber()
  @Min(5)
  @Max(480)
  durationMinutes!: number;

  @IsNumber()
  @Min(0)
  price!: number;
}
