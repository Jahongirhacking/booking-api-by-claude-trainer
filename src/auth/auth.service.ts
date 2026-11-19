import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ICurrentUser } from 'src/common/interfaces/current-user.interface';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validate(email: string, password: string): Promise<ICurrentUser> {
    try {
      const user = await this.usersService.getUserByEmail(email, true);
      if (!user || !(await bcrypt.compare(password, user.passwordHash)))
        throw new Error();
      return {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    } catch {
      throw new UnauthorizedException('Credentials are incorrect');
    }
  }

  login(user: ICurrentUser) {
    const { id: sub, ...payload } = user;
    const accessToken = this.jwtService.sign({ sub, ...payload });
    return { accessToken };
  }

  register(registerDto: RegisterDto) {
    return this.usersService.registerUser(registerDto);
  }

  async getProfile(userId: ICurrentUser['id']) {
    return this.usersService.getUserById(userId);
  }

  async updateProfile(userId: string, updateMeDto: UpdateMeDto) {
    return this.usersService.updateUser(userId, updateMeDto);
  }

  async updatePassword(
    userEmail: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.validate(userEmail, currentPassword);
    return this.usersService.updatePassword(user.id, newPassword);
  }
}
