import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ICurrentUser } from 'src/common/interfaces/current-user.interface';
import { RolesGuard } from 'src/rbac/guards/roles.guard';
import { UserRole } from 'src/users/entities/user.entity';
import { AvalabilityQueryDto } from './dto/avalability-query.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  getStaff(
    @Query('specialization') specialization: string,
    @Query('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser('id') userId: ICurrentUser['id'],
  ) {
    return this.staffService.getStaff(specialization, isActive, userId);
  }

  @Get(':id')
  getStaffById(@Param('id') id: string) {
    return this.staffService.getStaffWithId(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  createStaff(@Body() createStaffDto: CreateStaffDto) {
    return this.staffService.createStaff(createStaffDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  updateStaff(@Param('id') id: string, @Body() body: UpdateStaffDto) {
    return this.staffService.updateStaff(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  deleteStaff(@Param('id') id: string) {
    return this.staffService.deleteStaff(id);
  }

  @Get(':id/availability')
  getStaffAvailability(@Query() query: AvalabilityQueryDto) {
    return this.staffService.getStaffAvailability(query);
  }
}
