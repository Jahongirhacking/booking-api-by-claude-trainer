import { ServiceEntity } from 'src/services/entities/service.entity';
import { StaffEntity } from 'src/staff/entities/staff.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Entity('bookings')
export class BookingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  customerId!: string;

  @ManyToOne(() => UserEntity, (user) => user.bookings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customerId' })
  customer!: UserEntity;

  @Column({ type: 'varchar' })
  staffId!: string;

  @ManyToOne(() => StaffEntity, (staff) => staff.bookings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'staffId' })
  staff!: StaffEntity;

  @Column({ type: 'varchar' })
  serviceId!: string;

  @ManyToOne(() => ServiceEntity, (service) => service.bookings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'serviceId' })
  service!: ServiceEntity;

  @Column({ type: 'timestamptz' })
  startTime!: number;

  @Column({ type: 'timestamptz' })
  endTime!: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: number;
}
