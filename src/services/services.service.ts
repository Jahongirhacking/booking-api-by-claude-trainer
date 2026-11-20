import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceEntity } from './entities/service.entity';
import { IServicesQueryOut } from './pipes/services-query.pipe';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(ServiceEntity)
    private readonly serviceRepository: Repository<ServiceEntity>,
  ) {}

  getServices(query: IServicesQueryOut) {
    return this.serviceRepository.find({
      where: {
        ...(query.search
          ? {
              name: ILike(`%${query.search}%`),
            }
          : {}),
      },
      skip: query.pagination.skip,
      take: query.pagination.limit,
    });
  }

  async getServiceById(serviceId: string) {
    const service = await this.serviceRepository.findOne({
      where: { id: serviceId },
    });
    if (!service) throw new NotFoundException();
    return service;
  }

  async createService(createServiceDto: CreateServiceDto) {
    const service = this.serviceRepository.create({
      ...createServiceDto,
    });
    return await this.serviceRepository.save(service);
  }

  async updateService(serviceId: string, updateServiceDto: UpdateServiceDto) {
    const service = await this.getServiceById(serviceId);
    return this.serviceRepository.save({ ...service, ...updateServiceDto });
  }

  async removeService(serviceId: string) {
    const service = await this.getServiceById(serviceId);
    await this.serviceRepository.remove(service);
  }
}
