import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { ICurrentUser } from 'src/common/interfaces/current-user.interface';
import { UserRole } from 'src/users/entities/user.entity';
import { UsersService } from '../../users/users.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reqUser = context
      .switchToHttp()
      .getRequest<Request & { user: ICurrentUser }>().user;
    try {
      const user = await this.usersService.getUserById(reqUser.id);
      if (!user || !user.role) throw new Error();
      const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
        ROLES_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!requiredRoles) return true;
      return requiredRoles.includes(user.role);
    } catch {
      throw new ForbiddenException();
    }
  }
}
