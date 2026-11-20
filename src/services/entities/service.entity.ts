import { BookingEntity } from 'src/bookings/entities/booking.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('services')
export class ServiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @Column({ type: 'int', unsigned: true })
  durationMinutes!: number;

  @Column({
    type: 'decimal',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  price!: number;

  @Column({ type: 'varchar', nullable: true })
  imageUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  imageFile?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: number;

  @OneToMany(() => BookingEntity, (booking) => booking.service)
  bookings!: BookingEntity[];
}
