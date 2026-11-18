import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthStrategy } from './strategies/jwt.strategy';
import { LocalAuthStrategy } from './strategies/local.strategy';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    JwtAuthStrategy,
    LocalAuthGuard,
    LocalAuthStrategy,
  ],
})
export class AuthModule {}
