import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalAuthStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({ passwordField: 'password', usernameField: 'email' });
  }
  validate(email: string, password: string) {
    return this.authService.validate(email, password);
  }
}
