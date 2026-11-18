import { Body, Controller, Post } from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  createService(@Body() body: CreateServiceDto) {
    return this.servicesService.createService(body);
  }
}
