import { Injectable } from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';

@Injectable()
export class ServicesService {
  createService(createServiceDto: CreateServiceDto) {
    return createServiceDto;
  }
}
