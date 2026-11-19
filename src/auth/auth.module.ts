import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
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
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_EXPIRATION') || '1h',
        },
      }),
    }),
    UsersModule,
  ],
  exports: [AuthService],
})
export class AuthModule {}
