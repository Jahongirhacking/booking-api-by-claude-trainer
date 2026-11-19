import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { ServicesModule } from './services/services.module';
import { StaffModule } from './staff/staff.module';
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';

@Module({
  imports: [
    BookingsModule,
    StaffModule,
    UsersModule,
    ServicesModule,
    CommonModule,
    HealthModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST') || 'localhost',
        database: config.get('DB_NAME') || 'booking',
        username: config.get('DB_USER') || 'postgres',
        password: config.getOrThrow('DB_PASSWORD'),
        port: Number(config.get('DB_PORT')) || 5432,
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    RbacModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
