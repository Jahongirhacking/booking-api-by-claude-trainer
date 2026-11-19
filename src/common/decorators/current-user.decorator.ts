import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ICurrentUser } from '../interfaces/current-user.interface';

export const CurrentUser = createParamDecorator(
  (_property: keyof ICurrentUser | undefined, context: ExecutionContext) => {
    const user = context.switchToHttp().getRequest<Request>()
      .user as ICurrentUser;
    return _property ? user?.[_property] : user;
  },
);
