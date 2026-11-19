import { Module } from '@nestjs/common';
import { RolesGuard } from 'src/rbac/guards/roles.guard';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [UsersModule],
  providers: [RolesGuard],
  exports: [RolesGuard],
})
export class RbacModule {}
