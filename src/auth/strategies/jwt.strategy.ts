import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ICurrentUser } from 'src/common/interfaces/current-user.interface';
import { UserRole } from 'src/users/entities/user.entity';

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  validate(payload: {
    sub: string;
    email: string;
    role: UserRole;
  }): ICurrentUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
