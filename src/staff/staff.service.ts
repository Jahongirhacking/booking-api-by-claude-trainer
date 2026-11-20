import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BookingEntity,
  BookingStatus,
} from 'src/bookings/entities/booking.entity';
import { ICurrentUser } from 'src/common/interfaces/current-user.interface';
import { UserRole } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { Repository } from 'typeorm';
import { AvalabilityQueryDto } from './dto/avalability-query.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffEntity } from './entities/staff.entity';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffEntity)
    private readonly staffRepository: Repository<StaffEntity>,
    private readonly usersService: UsersService,
    @InjectRepository(BookingEntity)
    private readonly bookingsRepository: Repository<BookingEntity>,
  ) {}

  async getStaff(
    specialization: string,
    _isActive: boolean = true,
    userId: ICurrentUser['id'],
  ) {
    const user = await this.usersService.getUserById(userId);
    const isActive = user.role === UserRole.ADMIN ? _isActive : true;
    return this.staffRepository.find({
      where: { specialization, isActive },
      relations: { user: true },
      select: {
        user: {
          fullName: true,
          imageUrl: true,
        },
      },
    });
  }

  async getStaffWithId(id: string) {
    const staff = await this.staffRepository.findOne({ where: { id } });
    if (!staff) throw new NotFoundException();
    return staff;
  }

  async createStaff(createStaffDto: CreateStaffDto) {
    const staff = this.staffRepository.create({ ...createStaffDto });
    const savedStaff = await this.staffRepository.save(staff);
    await this.usersService.updateUser(createStaffDto.userId, {
      role: UserRole.STAFF,
    });
    return savedStaff;
  }

  async updateStaff(staffId: string, updateStaffDto: UpdateStaffDto) {
    const staff = await this.getStaffWithId(staffId);
    return this.staffRepository.save({ ...staff, ...updateStaffDto });
  }

  async deleteStaff(staffId: string) {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId },
      relations: {
        bookings: true,
      },
    });
    if (!staff) throw new NotFoundException();
    if (
      staff.bookings?.filter(
        (b) =>
          b.status === BookingStatus.PENDING ||
          b.status === BookingStatus.CONFIRMED,
      )?.length
    ) {
      await this.staffRepository.save({ ...staff, isActive: false });
      return;
    }
    await this.staffRepository.remove(staff);
  }

  async getStaffAvailability(query: AvalabilityQueryDto) {
    return this.bookingsRepository
      .createQueryBuilder('booking')
      .where('booking.serviceId = :serviceId', { serviceId: query.serviceId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      })
      .andWhere('booking.startTime < :endOfDay', {
        endOfDay: new Date(`${query.date}T23:59:59.999+05:00`),
      })
      .andWhere('booking.endTime > :startOfDay', {
        startOfDay: new Date(`${query.date}T00:00:00+05:00`),
      })
      .getMany();
  }
}
