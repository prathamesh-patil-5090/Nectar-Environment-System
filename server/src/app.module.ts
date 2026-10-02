import { existsSync } from 'fs';
import { join } from 'path';
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
import { NotificationsModule } from './modules/notifications/notifications.module';

/** Resolve server/.env whether Nest runs from src/ or dist/src/, any cwd. */
function resolveEnvFile(): string {
  const candidates = [
    join(process.cwd(), '.env'),
    join(__dirname, '..', '.env'), // src/app.module → server/.env
    join(__dirname, '..', '..', '.env'), // dist/src/app.module → server/.env
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

@Module({
  imports: [
    // Config — load server/.env (absolute candidate paths)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [resolveEnvFile()],
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
    NotificationsModule,
    HealthModule,
  ],
})
export class AppModule {}
