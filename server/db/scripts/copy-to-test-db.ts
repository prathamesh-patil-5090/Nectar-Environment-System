/**
 * Copy the main database into a throwaway test database (default "nectar_enviro_test"),
 * so end-to-end tests can create events, RSVPs and notifications without touching real data.
 *
 *   npx ts-node db/scripts/copy-to-test-db.ts [targetDbName]
 *
 * Refuses to write into the main database.
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SOURCE = process.env.MONGODB_DB_NAME ?? 'nectar_enviro';
const TARGET = process.argv[2] ?? 'nectar_enviro_test';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  if (TARGET === SOURCE || TARGET === 'nectar_enviro') throw new Error('Refusing to overwrite the main database');
  const conn = await mongoose.createConnection(uri).asPromise();
  const src = conn.useDb(SOURCE).db!;
  const dst = conn.useDb(TARGET).db!;
  await dst.dropDatabase();
  const collections = await src.listCollections().toArray();
  for (const { name } of collections) {
    const docs = await src.collection(name).find().toArray();
    if (docs.length) await dst.collection(name).insertMany(docs);
    console.log(`${name}: ${docs.length}`);
  }
  console.log(`\nCopied ${SOURCE} → ${TARGET}`);
  await conn.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
