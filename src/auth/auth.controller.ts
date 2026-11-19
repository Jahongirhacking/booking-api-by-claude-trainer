import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ICurrentUser } from 'src/common/interfaces/current-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Body() body: LoginDto, @CurrentUser() user: ICurrentUser) {
    return this.authService.login(user);
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser('id') userId: ICurrentUser['id']) {
    return this.authService.getProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(
    @CurrentUser('id') userId: ICurrentUser['id'],
    @Body() body: UpdateMeDto,
  ) {
    return this.authService.updateProfile(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  updatePassword(
    @CurrentUser('email') userEmail: ICurrentUser['email'],
    @Body() body: UpdatePasswordDto,
  ) {
    return this.authService.updatePassword(
      userEmail,
      body.currentPassword,
      body.newPassword,
    );
  }
}
