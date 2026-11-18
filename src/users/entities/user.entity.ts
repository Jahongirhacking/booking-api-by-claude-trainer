import { BookingEntity } from 'src/bookings/entities/booking.entity';
import { StaffEntity } from 'src/staff/entities/staff.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar' })
  fullName!: string;

  @Column({ type: 'varchar' })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Column({ type: 'varchar', nullable: true })
  imageUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  imageFile?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: number;

  @OneToOne(() => StaffEntity, (staff) => staff.user)
  staff!: StaffEntity;

  @OneToMany(() => BookingEntity, (booking) => booking.customer)
  bookings!: BookingEntity[];
}
