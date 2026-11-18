import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

@Injectable()
export class LocalAuthStrategy extends PassportStrategy(Strategy, 'local') {
  constructor() {
    super({ passwordField: 'password', usernameField: 'email' });
  }
  validate(email: string, password: string) {
    console.log(email, password);
    return {
      email,
    };
  }
}
