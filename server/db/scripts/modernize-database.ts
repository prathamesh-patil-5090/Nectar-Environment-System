import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OBSOLETE_COLLECTIONS_TO_DROP = [
  'job_categories',
  'skill_mapping_results',
  'practical_test_results',
  'written_test_results',
  'oral_test_results',
  'course_enrollments', // Duplicate of enrollments
  'enrollments', // Will be superseded by unified training_records
  'training_items', // Redundant with courses
  'reliever_absences', // Will be merged into relievers
  'lni_records', // Will be merged into training_records
];

async function modernizeDatabase() {
  const uri =
    process.env.MONGODB_URI ||
    'mongodb+srv://unicordhq_db_user:C5eYcSY4he4bRJRJ@nectar.vqimrur.mongodb.net/nectar_enviro';

  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log('│  🧹 Phase 1.1: MongoDB Atlas Collection Modernization  │');
  console.log('└────────────────────────────────────────────────────────┘');
  console.log(`Connecting to: ${uri.replace(/:([^:@]+)@/, ':****@')}`);

  await mongoose.connect(uri, { dbName: 'nectar_enviro' });
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('Database connection failed');
  }

  console.log('✅ Connected to MongoDB Atlas\n');

  // 1. Snapshot existing collections & counts
  console.log('--- [1] Snapshot of Existing Collections ---');
  const initialCollections = await db.listCollections().toArray();
  for (const c of initialCollections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`  • ${c.name.padEnd(25)} : ${count} docs`);
  }

  // 2. Drop obsolete collections
  console.log('\n--- [2] Dropping Obsolete & Duplicate Collections ---');
  const existingNames = initialCollections.map((c) => c.name);
  for (const name of OBSOLETE_COLLECTIONS_TO_DROP) {
    if (existingNames.includes(name)) {
      await db.collection(name).drop();
      console.log(`  ✓ Dropped obsolete collection: ${name}`);
    } else {
      console.log(`  - Collection ${name} was already absent`);
    }
  }

  // 3. Final verification of remaining collections
  console.log('\n--- [3] Cleaned Collections in Atlas ---');
  const remainingCollections = await db.listCollections().toArray();
  for (const c of remainingCollections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`  ✨ ${c.name.padEnd(25)} : ${count} docs`);
  }

  console.log('\n────────────────────────────────────────────────────────');
  console.log('🎉 Section 1.1 database cleanup finished successfully!');
  console.log('────────────────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

modernizeDatabase().catch((err) => {
  console.error('❌ Database cleanup failed:', err);
  process.exit(1);
});
