/**
 * Demo: every lesson video is 1 minute (idempotent).
 *
 *   npx ts-node db/migrations/2026-10-demo-one-minute-videos.ts           # dry run: prints what would change
 *   npx ts-node db/migrations/2026-10-demo-one-minute-videos.ts --apply   # writes
 *
 * courses.abilities[].videoDurationMinutes and courses.modules[].videos[].durationMinutes → 1.
 * Watch progress is stored as a percentage, so existing progress stays valid.
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const APPLY = process.argv.includes('--apply');
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'nectar_enviro';
const MINUTES = 1;

type Video = { durationMinutes?: number };
type CourseDoc = {
  id: string;
  code: string;
  abilities?: { videoDurationMinutes?: number }[];
  modules?: { videos?: Video[] }[];
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: DB_NAME });
  const courses = mongoose.connection.db!.collection<CourseDoc>('courses');
  console.log(APPLY ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');

  let changed = 0;
  for (const c of await courses.find({}).toArray()) {
    const abilities = (c.abilities ?? []).map((a) => ({ ...a, videoDurationMinutes: MINUTES }));
    const modules = (c.modules ?? []).map((m) => ({ ...m, videos: (m.videos ?? []).map((v) => ({ ...v, durationMinutes: MINUTES })) }));
    const before = [
      ...(c.abilities ?? []).map((a) => a.videoDurationMinutes),
      ...(c.modules ?? []).flatMap((m) => (m.videos ?? []).map((v) => v.durationMinutes)),
    ];
    if (before.every((m) => m === MINUTES)) continue;
    changed++;
    console.log(`  ${c.code}: ${before.join(', ')} min → ${MINUTES} min each`);
    if (APPLY) await courses.updateOne({ id: c.id }, { $set: { abilities, modules } });
  }
  console.log(`${changed} course(s) ${APPLY ? 'updated' : 'would change'}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
