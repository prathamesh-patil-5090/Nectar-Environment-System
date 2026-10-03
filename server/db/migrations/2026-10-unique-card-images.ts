/**
 * Give every training card its own image (additive, idempotent).
 *
 *   npx ts-node db/migrations/2026-10-unique-card-images.ts           # dry run: prints what would change
 *   npx ts-node db/migrations/2026-10-unique-card-images.ts --apply   # writes
 *
 * 1. courses.thumbnailUrl      ← the course seed (older databases point at files that no longer exist)
 * 2. training_events.coverUrl  ← a distinct cover per seeded event
 * 3. communities.coverUrl      ← a distinct cover per circle
 *
 * Only these fields are touched. Image credits: client/public/IMAGE_CREDITS.md
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { coursesSeed } from '../seeds/training/courses.seed';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const APPLY = process.argv.includes('--apply');
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'nectar_enviro';

const EVENT_COVERS: Record<string, string> = {
  'evt-session-mee-waghaskar': '/events/mee_masterclass_banner.jpg',
  'evt-session-ro-patil': '/events/ro_cip_masterclass.jpg',
  'evt-session-director-adsul': '/events/zld_strategy_session.jpg',
};

const COMMUNITY_COVERS: Record<string, string> = {
  'etp-operators-circle': '/communities/etp_operators_circle.jpg',
  'ro-membrane-circle': '/communities/ro_membrane_circle.jpg',
  'mee-zld-circle': '/communities/mee_zld_circle.jpg',
  'shift-leadership-circle': '/communities/shift_leadership_circle.jpg',
  'safety-circle': '/communities/safety_circle.jpg',
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: DB_NAME });
  const db = mongoose.connection.db!;
  console.log(APPLY ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');

  const plan: Array<{ collection: string; key: Record<string, string>; field: string; to: string }> = [
    ...coursesSeed
      .filter((c) => c.thumbnailUrl)
      .map((c) => ({ collection: 'courses', key: { id: c.id }, field: 'thumbnailUrl', to: c.thumbnailUrl as string })),
    ...Object.entries(EVENT_COVERS).map(([id, to]) => ({ collection: 'training_events', key: { id }, field: 'coverUrl', to })),
    ...Object.entries(COMMUNITY_COVERS).map(([slug, to]) => ({ collection: 'communities', key: { slug }, field: 'coverUrl', to })),
  ];

  let changed = 0;
  for (const p of plan) {
    const doc = await db.collection(p.collection).findOne(p.key, { projection: { [p.field]: 1 } });
    if (!doc) {
      console.log(`  skip  ${p.collection} ${JSON.stringify(p.key)} — not in the database`);
      continue;
    }
    if (doc[p.field] === p.to) continue;
    changed++;
    console.log(`  ${p.collection} ${Object.values(p.key)[0]}: ${doc[p.field] ?? '(none)'} → ${p.to}`);
    if (APPLY) await db.collection(p.collection).updateOne(p.key, { $set: { [p.field]: p.to } });
  }
  console.log(`${changed} field(s) ${APPLY ? 'updated' : 'would change'}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
