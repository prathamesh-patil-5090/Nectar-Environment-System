/**
 * Non-destructive safety seed: upserts protocols + the Safety In-Charge leader row.
 * Never deletes anything — safe to run against a live database.
 *   npm run seed:safety
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { safetyLeadersSeed, safetyProtocolsSeed } from './safety.seed';
import { SafetyProtocolSchema } from '../schemas/safety-protocol.schema';
import { LeaderSchema } from '../schemas/leader.schema';

async function run() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error('MONGODB_URI is missing. Set it in server/.env');
  const dbName = process.env.MONGODB_DB_NAME?.trim() || 'nectar_enviro';
  await mongoose.connect(uri, { dbName });
  console.log(`Safety seed → ${dbName}`);

  const Protocol = mongoose.model('SafetyProtocol', SafetyProtocolSchema, 'safety_protocols');
  const Leader = mongoose.model('Leader', LeaderSchema, 'leaders');

  let protocols = 0;
  for (const p of safetyProtocolsSeed) {
    // Only insert missing protocols — never overwrite edits made in the app
    const res = await Protocol.updateOne({ id: p.id }, { $setOnInsert: p }, { upsert: true });
    protocols += res.upsertedCount;
  }
  let leaders = 0;
  for (const l of safetyLeadersSeed) {
    const res = await Leader.updateOne({ id: l.id }, { $setOnInsert: l }, { upsert: true });
    leaders += res.upsertedCount;
  }
  console.log(`✓ Safety protocols inserted: ${protocols} (existing kept)`);
  console.log(`✓ Safety leaders inserted: ${leaders} (existing kept)`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Safety seed failed:', err);
  process.exit(1);
});
