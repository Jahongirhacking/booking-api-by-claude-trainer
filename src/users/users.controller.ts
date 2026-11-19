import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { UserRole } from './entities/user.entity';
import type { IUsersQueryOut } from './pipes/users-query.pipe';
import { UsersQueryPipe } from './pipes/users-query.pipe';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUsers(@Query(UsersQueryPipe) query: IUsersQueryOut) {
    return this.usersService.getUsers(query);
  }
}
