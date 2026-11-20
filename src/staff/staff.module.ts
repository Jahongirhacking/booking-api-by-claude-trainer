import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from 'src/bookings/bookings.module';
import { BookingEntity } from 'src/bookings/entities/booking.entity';
import { ServicesModule } from 'src/services/services.module';
import { UsersModule } from 'src/users/users.module';
import { StaffEntity } from './entities/staff.entity';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  controllers: [StaffController],
  providers: [StaffService],
  imports: [
    TypeOrmModule.forFeature([StaffEntity, BookingEntity]),
    UsersModule,
    ServicesModule,
    BookingsModule,
  ],
})
export class StaffModule {}
