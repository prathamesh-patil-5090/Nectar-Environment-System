/**
 * Plant types per site (idempotent).
 *
 *   npx ts-node db/migrations/2026-10-site-plant-types.ts           # dry run: prints what would change
 *   npx ts-node db/migrations/2026-10-site-plant-types.ts --apply   # writes
 *
 * sites.plantTypes ← every treatment process each plant runs, as confirmed by the client.
 * `plantType` (primary process, used for training audience targeting) is not changed here.
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const APPLY = process.argv.includes('--apply');
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'nectar_enviro';

const PLANT_TYPES: Record<string, string[]> = {
  's-etp': ['ETP', 'STP', 'WTP', 'RO'], // Thane
  's-ro': ['MEE', 'WTP'], // Pune
  's-mee': ['MEE', 'STP', 'RO'], // Vashi
  's-rajasthan': ['ETP', 'STP', 'WTP', 'RO', 'MEE'], // Rajasthan (new plant)
  's-virar': ['RO', 'ETP', 'MEE', 'WTP'], // Virar
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: DB_NAME });
  const sites = mongoose.connection.db!.collection('sites');
  console.log(APPLY ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');

  for (const [id, plantTypes] of Object.entries(PLANT_TYPES)) {
    const site = await sites.findOne({ id });
    if (!site) {
      console.log(`   ${id}: not found — skipped`);
      continue;
    }
    console.log(`   ${site.name}: [${(site.plantTypes ?? []).join(', ')}] → [${plantTypes.join(', ')}]`);
    if (APPLY) await sites.updateOne({ id }, { $set: { plantTypes, updatedAt: new Date() } });
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
