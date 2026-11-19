import { UserRole } from 'src/users/entities/user.entity';

export interface ICurrentUser {
  id: string;
  email: string;
  role: UserRole;
}
