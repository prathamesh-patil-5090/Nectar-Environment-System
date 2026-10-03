/**
 * Site names and multiple plant types (idempotent).
 *
 *   npx ts-node db/migrations/2026-10-site-names-plant-types.ts           # dry run: prints what would change
 *   npx ts-node db/migrations/2026-10-site-names-plant-types.ts --apply   # writes
 *
 * 1. sites.name       ← "Nectar Enviro, <location>" — a site is named after where it is, not what it treats
 * 2. sites.plantTypes ← a plant can run several processes; seeded from the single `plantType` where unset
 *
 * `plantType` stays as the primary process (training audience targeting uses it).
 * Titles already written into events/communities ("… — ETP Plant") are not rewritten.
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const APPLY = process.argv.includes('--apply');
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'nectar_enviro';

/** "Thane, MH" → "Nectar Enviro, Thane" */
const siteName = (location: string) => `Nectar Enviro, ${location.split(',')[0].trim()}`;

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: DB_NAME });
  const sites = mongoose.connection.db!.collection('sites');
  console.log(APPLY ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');

  for (const s of await sites.find({}).toArray()) {
    const name = s.location ? siteName(s.location as string) : (s.name as string);
    const plantTypes: string[] = s.plantTypes?.length ? s.plantTypes : s.plantType ? [s.plantType] : [];
    console.log(`   ${s.id}: "${s.name}" → "${name}"  types [${plantTypes.join(', ')}]`);
    if (APPLY) await sites.updateOne({ id: s.id }, { $set: { name, plantTypes, updatedAt: new Date() } });
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
