import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/rbac/guards/roles.guard';
import { UserRole } from 'src/users/entities/user.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import type { IServicesQueryOut } from './pipes/services-query.pipe';
import { ServicesQueryPipe } from './pipes/services-query.pipe';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  getServices(@Query(ServicesQueryPipe) query: IServicesQueryOut) {
    return this.servicesService.getServices(query);
  }

  @Get(':id')
  getServiceById(@Param('id') id: string) {
    return this.servicesService.getServiceById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  createService(@Body() body: CreateServiceDto) {
    return this.servicesService.createService(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  updateService(@Param('id') id: string, @Body() body: UpdateServiceDto) {
    return this.servicesService.updateService(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  removeService(@Param('id') id: string) {
    return this.servicesService.removeService(id);
  }
}
