/**
 * Plant pipeline (additive, idempotent).
 *
 *   npx ts-node db/migrations/2026-10-plant-pipeline.ts           # dry run: prints what would change
 *   npx ts-node db/migrations/2026-10-plant-pipeline.ts --apply   # writes
 *
 * 1. sites ← every existing plant without a status becomes `operational`
 * 2. sites ← Nectar Enviro, Rajasthan (new) / Indore (upcoming) / Virar (closed)
 *
 * Only `GET /sites?scope=all` returns non-operational plants, and only the Director's Sites page asks for it,
 * so these plants never show up in rosters, safety, training or any other site list.
 * Plant type, headcount and manager are left empty until they are known.
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const APPLY = process.argv.includes('--apply');
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'nectar_enviro';

/** headcount: staff on the books when the plant closed (Virar) — left unset for plants not yet running. */
const PLANTS: { id: string; name: string; location: string; status: string; headcount?: number }[] = [
  { id: 's-rajasthan', name: 'Nectar Enviro, Rajasthan', location: 'Rajasthan', status: 'new' },
  { id: 's-indore', name: 'Nectar Enviro, Indore', location: 'Indore, MP', status: 'upcoming' },
  { id: 's-virar', name: 'Nectar Enviro, Virar', location: 'Virar, MH', status: 'closed', headcount: 12 },
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: DB_NAME });
  const sites = mongoose.connection.db!.collection('sites');
  console.log(APPLY ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');

  // 1. Existing plants are operational
  const unset = await sites.find({ status: { $exists: false } }).toArray();
  console.log(`\n1. Mark operational — ${unset.map((s) => s.name).join(', ') || 'nothing to do'}`);
  if (APPLY && unset.length) {
    await sites.updateMany({ status: { $exists: false } }, { $set: { status: 'operational', updatedAt: new Date() } });
  }

  // 2. Pipeline and closed plants
  console.log('\n2. Plants');
  for (const p of PLANTS) {
    const existing = await sites.findOne({ id: p.id });
    const headcount = p.headcount === undefined ? '' : `, headcount ${p.headcount}`;
    console.log(`   ${existing ? 'update' : 'insert'} ${p.name} (${p.location}) — ${p.status}${headcount}`);
    if (!APPLY) continue;
    await sites.updateOne(
      { id: p.id },
      {
        $set: {
          siteId: p.id,
          name: p.name,
          location: p.location,
          status: p.status,
          ...(p.headcount === undefined ? {} : { headcount: p.headcount }),
          updatedAt: new Date(),
        },
        $setOnInsert: { ...(p.headcount === undefined ? { headcount: 0 } : {}), readiness: 0, createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
