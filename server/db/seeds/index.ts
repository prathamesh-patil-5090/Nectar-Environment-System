import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { employeesSeed } from './employees.seed';
import { sitesSeed } from './sites.seed';
import { relieversSeed } from './relievers.seed';
import { leavesSeed } from './leaves.seed';
import {
  leavePolicySeed,
  leaveBalancesSeed,
} from './leave-policy.seed';
import { shiftsSeed } from './shifts.seed';
import { coursesSeed } from './training/courses.seed';
import { trainingRecordsSeed } from './training/training-records.seed';
import { certificatesSeed } from './training/certificates.seed';
import { trainingSessionsSeed } from './training/training-sessions.seed';
import { getMentorLiveSessionsSeed } from './training/mentor-sessions.seed';
import { trainingAssignmentsSeed } from './training/assignments.seed';

import { EmployeeSchema } from '../schemas/employee.schema';
import { SiteSchema } from '../schemas/site.schema';
import { RelieverSchema } from '../schemas/reliever.schema';
import { LeaveRequestSchema } from '../schemas/leave-request.schema';
import { LeavePolicySchema } from '../schemas/leave-policy.schema';
import { LeaveBalanceSchema } from '../schemas/leave-balance.schema';
import { ShiftRosterSchema } from '../schemas/shift-roster.schema';
import {
  CourseSchema,
  TrainingRecordSchema,
  CertificateSchema,
  TrainingSessionSchema,
  MentorLiveSessionSchema,
  TrainingAssignmentSchema,
} from '../schemas/training';

async function seed() {
  const uri =
    process.env.MONGODB_URI ||
    'mongodb+srv://unicordhq_db_user:C5eYcSY4he4bRJRJ@nectar.vqimrur.mongodb.net/nectar_enviro';

  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log('│  🌱 Nectar Enviro — Unified Modern Database Seeder    │');
  console.log('└────────────────────────────────────────────────────────┘');
  console.log(`Connecting to: ${uri.replace(/:([^:@]+)@/, ':****@')}`);

  await mongoose.connect(uri, { dbName: 'nectar_enviro' });
  console.log('✅ Connected to MongoDB Atlas\n');

  const EmployeeModel = mongoose.model('Employee', EmployeeSchema, 'employees');
  const SiteModel = mongoose.model('Site', SiteSchema, 'sites');
  const RelieverModel = mongoose.model('Reliever', RelieverSchema, 'reliever_pool');
  const LeaveModel = mongoose.model('LeaveRequest', LeaveRequestSchema, 'leaves');
  const LeavePolicyModel = mongoose.model(
    'LeavePolicy',
    LeavePolicySchema,
    'leave_policies',
  );
  const LeaveBalanceModel = mongoose.model(
    'LeaveBalance',
    LeaveBalanceSchema,
    'leave_balances',
  );
  const ShiftRosterModel = mongoose.model('ShiftRoster', ShiftRosterSchema, 'shift_rosters');
  const CourseModel = mongoose.model('Course', CourseSchema, 'courses');
  const TrainingRecordModel = mongoose.model('TrainingRecord', TrainingRecordSchema, 'training_records');
  const CertificateModel = mongoose.model('Certificate', CertificateSchema, 'certificates');
  const TrainingSessionModel = mongoose.model('TrainingSession', TrainingSessionSchema, 'training_sessions');
  const MentorLiveSessionModel = mongoose.model(
    'MentorLiveSession',
    MentorLiveSessionSchema,
    'mentor_live_sessions',
  );
  const TrainingAssignmentModel = mongoose.model(
    'TrainingAssignment',
    TrainingAssignmentSchema,
    'training_assignments',
  );

  // Clear collections and drop stale indexes for fresh clean seed
  console.log('🧹 Purging outdated collections & indexes...');
  await EmployeeModel.deleteMany({});
  await SiteModel.deleteMany({});
  await RelieverModel.collection.drop().catch(() => {});
  await LeaveModel.deleteMany({});
  await LeavePolicyModel.deleteMany({});
  await LeaveBalanceModel.deleteMany({});
  await ShiftRosterModel.collection.drop().catch(() => {});
  await CourseModel.collection.drop().catch(() => {});
  await TrainingRecordModel.collection.drop().catch(() => {});
  await CertificateModel.collection.drop().catch(() => {});
  await TrainingSessionModel.collection.drop().catch(() => {});
  await MentorLiveSessionModel.collection.drop().catch(() => {});
  await TrainingAssignmentModel.collection.drop().catch(() => {});
  console.log('✅ Cleared domain collections & indexes\n');

  // 1. Employees (25 real staff)
  console.log('[1/13] Seeding Employees...');
  await EmployeeModel.insertMany(employeesSeed);
  console.log(`  ✓ Inserted ${employeesSeed.length} employees (emp0123–emp0147)`);

  // 2. Sites (ETP, RO, MEE)
  console.log('[2/13] Seeding Sites...');
  await SiteModel.insertMany(sitesSeed);
  console.log(`  ✓ Inserted ${sitesSeed.length} sites with designated plant managers`);

  // 3. Relievers & Absences
  console.log('[3/13] Seeding Reliever Pool & Coverage...');
  await RelieverModel.insertMany(relieversSeed);
  console.log(`  ✓ Inserted ${relieversSeed.length} cluster relievers with plant skills`);

  // 4. Leave policy + balances
  console.log('[4/13] Seeding Leave Policy...');
  await LeavePolicyModel.create(leavePolicySeed);
  console.log(`  ✓ Inserted org leave policy (notice ${leavePolicySeed.noticeDays}d)`);

  console.log('[5/13] Seeding Leave Balances...');
  await LeaveBalanceModel.insertMany(leaveBalancesSeed);
  console.log(`  ✓ Inserted ${leaveBalancesSeed.length} employee leave balances`);

  // 6. Leave requests
  console.log('[6/13] Seeding Leave Requests...');
  await LeaveModel.insertMany(leavesSeed);
  console.log(`  ✓ Inserted ${leavesSeed.length} leave / absence demo cases`);

  // 7. Shift Rosters & Change Requests
  console.log('[7/13] Seeding Shift Rosters...');
  await ShiftRosterModel.insertMany(shiftsSeed);
  console.log(`  ✓ Inserted ${shiftsSeed.length} monthly shift rosters with change requests`);

  // 8. Training Courses
  console.log('[8/13] Seeding Courses Syllabus...');
  await CourseModel.insertMany(coursesSeed);
  console.log(`  ✓ Inserted ${coursesSeed.length} rich syllabus courses`);

  // 9. Unified Training Records (Progress + 4-Tier Assessments + LNI)
  console.log('[9/13] Seeding Unified Training Records...');
  await TrainingRecordModel.insertMany(trainingRecordsSeed);
  console.log(`  ✓ Inserted ${trainingRecordsSeed.length} student records (skillMap, written, practical, oral)`);

  // 10. Verifiable Certificates
  console.log('[10/13] Seeding Certificates...');
  await CertificateModel.insertMany(certificatesSeed);
  console.log(`  ✓ Inserted ${certificatesSeed.length} certified credentials with SHA256 hashes`);

  // 11. Training Workshops & Drills
  console.log('[11/13] Seeding Training Sessions...');
  await TrainingSessionModel.insertMany(trainingSessionsSeed);
  console.log(`  ✓ Inserted ${trainingSessionsSeed.length} scheduled classroom & on-site workshop drills`);

  // 12. Executive & Plant Lead Masterclasses (with Base64 Images)
  console.log('[12/13] Seeding Executive & Plant Lead Masterclasses...');
  const mentorLiveSessionsSeed = getMentorLiveSessionsSeed();
  await MentorLiveSessionModel.insertMany(mentorLiveSessionsSeed);
  console.log(
    `  ✓ Inserted ${mentorLiveSessionsSeed.length} Masterclasses (Founder, ETP, RO, MEE) into MongoDB!`,
  );

  // 13. Manager Training Directives & Assignments
  console.log('[13/13] Seeding Manager Training Assignments...');
  await TrainingAssignmentModel.insertMany(trainingAssignmentsSeed);
  console.log(`  ✓ Inserted ${trainingAssignmentsSeed.length} active manager directives & assignments`);

  console.log('\n────────────────────────────────────────────────────────');
  console.log('🎉 Unified database seeding completed successfully!');
  console.log('────────────────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
