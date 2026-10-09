/**
 * Non-destructive E-Permit seed: upserts departments, locations, emergency contacts,
 * HoD / deputy leader rows and their logins. Never deletes or overwrites — safe on a live database.
 *   npm run seed:e-permits
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import {
  departmentsSeed,
  hodLeadersSeed,
  hodUsersSeed,
  permitLocationsSeed,
  siteEmergencyContactsSeed,
} from './e-permit.seed';
import {
  DepartmentSchema,
  PermitLocationSchema,
  SiteEmergencyContactSchema,
} from '../schemas/e-permit-master.schema';
import { LeaderSchema } from '../schemas/leader.schema';
import { UserSchema } from '../schemas/user.schema';

async function upsertAll(model: mongoose.Model<any>, rows: any[], key = 'id'): Promise<number> {
  let inserted = 0;
  for (const row of rows) {
    const res = await model.updateOne({ [key]: row[key] }, { $setOnInsert: row }, { upsert: true });
    inserted += res.upsertedCount;
  }
  return inserted;
}

async function run() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error('MONGODB_URI is missing. Set it in server/.env');
  const dbName = process.env.MONGODB_DB_NAME?.trim() || 'nectar_enviro';
  await mongoose.connect(uri, { dbName });
  console.log(`E-Permit seed → ${dbName}`);

  const Department = mongoose.model('Department', DepartmentSchema, 'departments');
  const Location = mongoose.model('PermitLocation', PermitLocationSchema, 'permit_locations');
  const Contact = mongoose.model('SiteEmergencyContact', SiteEmergencyContactSchema, 'site_emergency_contacts');
  const Leader = mongoose.model('Leader', LeaderSchema, 'leaders');
  const User = mongoose.model('User', UserSchema, 'users');

  console.log(`✓ Departments inserted: ${await upsertAll(Department, departmentsSeed)} (existing kept)`);
  console.log(`✓ Locations inserted: ${await upsertAll(Location, permitLocationsSeed)} (existing kept)`);
  // Concerned departments: fill only locations that have none yet, so a Director's later edits survive a re-run.
  let filled = 0;
  for (const l of permitLocationsSeed) {
    const r = await Location.updateOne(
      { id: l.id, $or: [{ concernedDepartmentIds: { $exists: false } }, { concernedDepartmentIds: { $size: 0 } }] },
      { $set: { concernedDepartmentIds: l.concernedDepartmentIds } },
    );
    filled += r.modifiedCount;
  }
  console.log(`✓ Concerned departments filled on ${filled} locations (lists already set were kept)`);
  console.log(`✓ Emergency contacts inserted: ${await upsertAll(Contact, siteEmergencyContactsSeed)} (existing kept)`);
  console.log(`✓ HoD leaders inserted: ${await upsertAll(Leader, hodLeadersSeed)} (existing kept)`);
  console.log(`✓ HoD logins inserted: ${await upsertAll(User, hodUsersSeed, 'email')} (existing kept)`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ E-Permit seed failed:', err);
  process.exit(1);
});
