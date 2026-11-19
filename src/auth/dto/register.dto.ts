import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  fullName!: string;
}
