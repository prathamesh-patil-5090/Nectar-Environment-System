/**
 * Safety training sessions (additive, idempotent).
 *
 *   npx ts-node db/migrations/2026-10-safety-training-events.ts           # dry run: prints what would change
 *   npx ts-node db/migrations/2026-10-safety-training-events.ts --apply   # writes
 *
 * 1. mentor_profiles  ← the Safety In-Charge (a leader login) becomes a mentor
 * 2. training_events  ← "Fire Safety & Emergency Evacuation Drill": in person at every site, a different date per site,
 *                       assigned by that site's manager, run by the Safety In-Charge (one series)
 *                    ← "Chemical Handling, PPE & Spill Response": one online mentor session by the Safety In-Charge
 *
 * 3. communities      ← Safety Circle becomes a default community: everyone (employees and leaders) is a member,
 *                       nobody can leave; the Safety In-Charge leads it with the plant managers
 *
 * Re-running updates these records in place; RSVPs and posts are never touched.
 * Cover image credits: client/public/IMAGE_CREDITS.md
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const APPLY = process.argv.includes('--apply');
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'nectar_enviro';

const SAFETY_LEAD = 'user:safety@nectarenviro.com';
const PLANT_ROLES = ['employee', 'supervisor', 'shift_incharge', 'manager', 'safety_incharge'];

/** IST wall-clock → ISO (UTC). */
const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString();

const DRILL = {
  title: 'Fire Safety & Emergency Evacuation Drill',
  description:
    'Hands-on drill at your plant: raising the alarm, choosing and using the right extinguisher (P.A.S.S.), ' +
    'hydrant and hose-reel operation, evacuation routes and the assembly-point head count. ' +
    'Every person on site takes part; the Safety In-Charge runs it and records the evacuation time.',
  agenda: [
    { time: '10:00', item: 'Fire classes and extinguisher types (A, B, C, electrical)' },
    { time: '10:30', item: 'Live extinguisher practice on a controlled tray fire' },
    { time: '11:15', item: 'Unannounced alarm, evacuation and assembly-point head count' },
    { time: '11:45', item: 'Debrief: evacuation time, gaps found, actions' },
  ],
  topics: ['Fire Safety', 'Emergency Evacuation', 'Fire Extinguishers'],
};

/** One drill per site, each on its own date. */
const DRILLS = [
  { siteId: 's-etp', date: '2026-10-12', room: 'Main gate assembly point & hydrant bay', cover: '/events/safety_drill_etp.jpg' },
  { siteId: 's-ro', date: '2026-10-14', room: 'RO building forecourt', cover: '/events/safety_drill_ro.jpg' },
  { siteId: 's-mee', date: '2026-10-16', room: 'MEE control-room lawn', cover: '/events/safety_drill_mee.jpg' },
];

const SESSION = {
  id: 'evt-safety-chemical-handling',
  title: 'Chemical Handling, PPE & Spill Response for Dosing Areas',
  description:
    'Live online session on the chemicals we dose every day (sulphuric acid, caustic, hypochlorite, antiscalant): ' +
    'reading the SDS, choosing the right PPE, safe decanting and transfer, and what to do in the first five minutes of a spill or splash.',
  agenda: [
    { time: '15:00', item: 'Reading an SDS: hazards, incompatibles, first aid' },
    { time: '15:20', item: 'PPE by task: goggles vs face shield, glove materials, aprons' },
    { time: '15:40', item: 'Spill kits, neutralising and containment — walk-through' },
    { time: '16:10', item: 'Q&A from the plants' },
  ],
  topics: ['Chemical Safety', 'PPE', 'Spill Response'],
  date: '2026-10-09',
  cover: '/events/chemical_safety_session.webp',
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: DB_NAME });
  const db = mongoose.connection.db!;
  console.log(APPLY ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');

  const lead = await db.collection('leaders').findOne({ id: SAFETY_LEAD, active: true });
  if (!lead) throw new Error(`${SAFETY_LEAD} is not in leaders — log in once as the Safety In-Charge, or run the training-events migration`);
  const [sites, managers, community] = await Promise.all([
    db.collection('sites').find({}).toArray(),
    db.collection('employees').find({ employeeCategory: 'manager' }).toArray(),
    db.collection('communities').findOne({ slug: 'safety-circle' }),
  ]);
  const siteById = new Map(sites.map((s) => [s.id as string, s]));
  const managerOf = (siteId: string) => managers.find((m) => m.siteId === siteId);

  // 3. Safety Circle — default community for everyone (runs first so the events below link to it)
  console.log(`
3. Safety Circle — ${community ? "update" : "missing"}`);
  if (community && APPLY) {
    await db.collection('communities').updateOne(
      { id: community.id },
      {
        $set: {
          everyone: true,
          optedOutEmployeeIds: [],
          organizerEmployeeIds: [SAFETY_LEAD, ...managers.map((m) => m.id as string)],
          description:
            'Everyone at Nectar Enviro is a member. Site safety for all: fire drills, LOTO, PPE, chemical handling, ' +
            'confined space and near-miss learnings. Led by the Safety In-Charge with the plant managers.',
          updatedAt: new Date(),
        },
      },
    );
  }

  // 1. Mentor profile
  console.log(`\n1. Mentor profile — ${lead.name}`);
  if (APPLY) {
    await db.collection('mentor_profiles').updateOne(
      { employeeId: SAFETY_LEAD },
      {
        $set: {
          name: lead.name,
          title: lead.title ?? 'Safety In-Charge',
          department: 'Health, Safety & Environment',
          specialties: ['Fire Safety', 'Chemical Handling', 'LOTO', 'Emergency Response'],
          active: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { id: `mentor-${SAFETY_LEAD}`, createdAt: new Date() },
      },
      { upsert: true },
    );
  }

  // 2. Events
  console.log('\n2. Events');
  const upsertEvent = async (id: string, fields: Record<string, unknown>) => {
    const exists = await db.collection('training_events').findOne({ id }, { projection: { _id: 1 } });
    console.log(`  ${exists ? 'update' : 'insert'} ${id} — ${fields.title} — ${fields.startsAt} — assigned by ${(fields.assignedBy as { name: string }).name}`);
    if (!APPLY) return;
    await db.collection('training_events').updateOne(
      { id },
      {
        $set: { ...fields, updatedAt: new Date() },
        $setOnInsert: { id, status: 'published', remindersSent: [], createdAt: new Date() },
      },
      { upsert: true },
    );
  };

  for (const d of DRILLS) {
    const site = siteById.get(d.siteId);
    const mgr = managerOf(d.siteId);
    if (!site || !mgr) {
      console.log(`  skip ${d.siteId} — ${!site ? 'site' : 'manager'} not found`);
      continue;
    }
    await upsertEvent(`evt-safety-drill-${d.siteId}`, {
      seriesId: 'series-safety-fire-drill',
      communityId: community?.id,
      type: 'workshop',
      title: `${DRILL.title} — ${site.name}`,
      description: DRILL.description,
      agenda: DRILL.agenda,
      topics: DRILL.topics,
      audience: { roles: PLANT_ROLES, plantTypes: [site.plantType] },
      coverUrl: d.cover,
      assignedBy: { id: mgr.id, name: mgr.name },
      hostEmployeeIds: [SAFETY_LEAD],
      startsAt: ist(d.date, '10:00'),
      endsAt: ist(d.date, '12:00'),
      format: 'in_person',
      meetLink: '',
      venue: { siteId: d.siteId, room: d.room },
      capacity: 30,
      waitlistEnabled: false,
    });
  }

  // The Safety In-Charge sits at the ETP site, so its manager assigns the company-wide session
  const leadManager = managerOf((lead.siteId as string | undefined) ?? 's-etp');
  if (leadManager) {
    await upsertEvent(SESSION.id, {
      communityId: community?.id,
      type: 'masterclass',
      title: SESSION.title,
      description: SESSION.description,
      agenda: SESSION.agenda,
      topics: SESSION.topics,
      audience: { roles: PLANT_ROLES },
      coverUrl: SESSION.cover,
      assignedBy: { id: leadManager.id, name: leadManager.name },
      hostEmployeeIds: [SAFETY_LEAD],
      startsAt: ist(SESSION.date, '15:00'),
      endsAt: ist(SESSION.date, '16:30'),
      format: 'online',
      meetLink: 'https://meet.jit.si/neipl-safety-chemical-handling',
      capacity: 60,
      waitlistEnabled: true,
    });
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
