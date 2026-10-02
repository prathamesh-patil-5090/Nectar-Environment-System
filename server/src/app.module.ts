import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { TrainingModule } from './modules/training/training.module';
import { RelieversModule } from './modules/relievers/relievers.module';
import { SitesModule } from './modules/sites/sites.module';
import { HealthModule } from './modules/health/health.module';
import { MeetingsModule } from './modules/meetings/meetings.module';

@Module({
  imports: [
    // Config — load .env
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),
    // Database
    DatabaseModule,
    // Feature modules
    EmployeesModule,
    SitesModule,
    LeavesModule,
    ShiftsModule,
    TrainingModule,
    RelieversModule,
    MeetingsModule,
    HealthModule,
  ],
})
export class AppModule {}
