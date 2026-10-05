/**
 * Training redesign migration (additive, idempotent).
 *
 *   npx ts-node db/migrations/2026-10-training-events.ts           # dry run: prints what would change
 *   npx ts-node db/migrations/2026-10-training-events.ts --apply   # writes
 *
 * 0. leaders           ← the Director (not an employee); id = "user:<login email>"
 * 1. mentor_profiles   ← mentors of mentor_live_sessions matched by name to an employee or leader
 * 2. communities       ← one circle per plant + Shift Leadership + Safety (names proposed, see plan §7)
 * 3. training_events   ← mentor_live_sessions whose scheduledAt parses to a real date and whose mentor is an employee
 *    event_rsvps       ← enrolledEmployeeIds (the stored registeredCount is ignored)
 *    event_posts       ← questions
 * 4. courses.skills    ← ability titles, where skills is empty
 *
 * Nothing is deleted. mentor_live_sessions stays until the client stops reading it.
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { EmployeeSchema } from '../schemas/employee.schema';
import { LeaderSchema } from '../schemas/leader.schema';
import { SiteSchema } from '../schemas/site.schema';
import {
  CourseSchema,
  MentorLiveSessionSchema,
  MentorProfileSchema,
  CommunitySchema,
  TrainingEventSchema,
  EventRsvpSchema,
  EventPostSchema,
} from '../schemas/training';

const APPLY = process.argv.includes('--apply');
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'nectar_enviro';

/** Non-employee users. Must match the client's person id for logins without an employeeId. */
const LEADERS = [
  { email: 'director@nectarenviro.com', name: 'Prashant Rohidas Adsul', role: 'director', title: 'Founder & Managing Director' },
];

const ALL_ROLES = ['employee', 'shift_incharge', 'supervisor', 'safety_incharge', 'site_incharge', 'manager', 'hr'];
const PLANT_CIRCLES: Record<string, { slug: string; name: string; description: string }> = {
  ETP: { slug: 'etp-operators-circle', name: 'ETP Operators Circle', description: 'Effluent treatment: biology, clarifiers, sludge and dosing. For everyone at the ETP plant.' },
  RO: { slug: 'ro-membrane-circle', name: 'RO & Membrane Circle', description: 'RO, UF and membrane care: fouling, CIP, normalisation. For everyone at the RO plant.' },
  MEE: { slug: 'mee-zld-circle', name: 'MEE & ZLD Circle', description: 'Evaporators, ATFD and zero liquid discharge. For everyone at the MEE plant.' },
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "Wednesday, Oct 7 · 15:00 - 16:15 IST" → ISO start/end. Relative words ("Tomorrow") are not trusted. */
function parseScheduledAt(text: string, year: number): { startsAt: string; endsAt: string } | null {
  const m = text.match(/([A-Za-z]{3})[a-z]*\s+(\d{1,2})\s*·\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  const pad = (n: string | number) => String(n).padStart(2, '0');
  const day = `${year}-${pad(month + 1)}-${pad(m[2])}`;
  const startsAt = new Date(`${day}T${pad(m[3])}:${m[4]}:00+05:30`).toISOString();
  const endsAt = new Date(`${day}T${pad(m[5])}:${m[6]}:00+05:30`).toISOString();
  return { startsAt, endsAt };
}

const log = (...a: unknown[]) => console.log(APPLY ? '  ✔' : '  •', ...a);

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set — add it to server/.env');
  await mongoose.connect(uri, { dbName: DB_NAME });
  console.log(`\nTraining events migration on "${DB_NAME}" — ${APPLY ? 'APPLY' : 'DRY RUN (pass --apply to write)'}\n`);

  const Employee = mongoose.model('Employee', EmployeeSchema, 'employees');
  const Leader = mongoose.model('Leader', LeaderSchema, 'leaders');
  const Site = mongoose.model('Site', SiteSchema, 'sites');
  const Course = mongoose.model('Course', CourseSchema, 'courses');
  const LegacySession = mongoose.model('MentorLiveSession', MentorLiveSessionSchema, 'mentor_live_sessions');
  const Mentor = mongoose.model('MentorProfile', MentorProfileSchema, 'mentor_profiles');
  const Community = mongoose.model('Community', CommunitySchema, 'communities');
  const Event = mongoose.model('TrainingEvent', TrainingEventSchema, 'training_events');
  const Rsvp = mongoose.model('EventRsvp', EventRsvpSchema, 'event_rsvps');
  const Post = mongoose.model('EventPost', EventPostSchema, 'event_posts');

  const employees = await Employee.find().lean();
  const byName = new Map(employees.map((e) => [e.name.trim().toLowerCase(), e]));
  const empById = new Map(employees.map((e) => [e.id, e]));
  const sites = await Site.find().lean();
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const sessions = await LegacySession.find().lean();
  const skipped: string[] = [];

  // 0. Leaders (non-employees)
  console.log('0. Leaders');
  const leaderByName = new Map<string, { id: string; name: string; title: string }>();
  for (const l of LEADERS) {
    const id = `user:${l.email}`;
    leaderByName.set(l.name.toLowerCase(), { id, name: l.name, title: l.title });
    log(`${l.name} — ${l.title} (${id})`);
    if (APPLY) {
      await Leader.updateOne(
        { id },
        { $set: { name: l.name, role: l.role, title: l.title, email: l.email, active: true }, $setOnInsert: { id } },
        { upsert: true },
      );
    }
  }

  // 1. Mentor profiles
  console.log('\n1. Mentor profiles');
  const mentorEmpIdBySession = new Map<string, string>();
  for (const s of sessions) {
    const key = s.mentorName.trim().toLowerCase();
    const emp = byName.get(key);
    const leader = leaderByName.get(key);
    const person = emp ? { id: emp.id, name: emp.name, title: emp.designation } : leader;
    if (!person) {
      skipped.push(`Mentor "${s.mentorName}" (session ${s.id}) is not an employee or leader — no profile, no event`);
      continue;
    }
    mentorEmpIdBySession.set(s.id, person.id);
    log(`${person.name} (${person.id}) — ${person.title}`);
    if (APPLY) {
      await Mentor.updateOne(
        { employeeId: person.id },
        {
          $set: { name: person.name, title: person.title, department: s.mentorDepartment, photoUrl: s.photoDataUrl, active: true },
          $setOnInsert: { id: `mentor-${person.id}`, specialties: [] },
        },
        { upsert: true },
      );
    }
  }

  // 2. Communities: one circle per plant, plus Shift Leadership and Safety
  console.log('\n2. Communities');
  const communityByPlant = new Map<string, string>();
  const managers = sites.map((x) => x.managerId).filter((m): m is string => Boolean(m && empById.has(m)));
  const circles: Array<{ slug: string; name: string; description: string; domain: string; organizers: string[]; autoJoin: Record<string, string[]> }> = [];
  for (const site of sites) {
    if (!site.plantType) continue;
    const c = PLANT_CIRCLES[site.plantType] ?? {
      slug: `${site.plantType.toLowerCase()}-plant-circle`,
      name: `${site.plantType} Plant Circle`,
      description: `For everyone at the ${site.name}.`,
    };
    communityByPlant.set(site.plantType, `com-${c.slug}`);
    circles.push({ ...c, domain: site.plantType, organizers: site.managerId && empById.has(site.managerId) ? [site.managerId] : [], autoJoin: { plantTypes: [site.plantType] } });
  }
  circles.push({
    slug: 'shift-leadership-circle',
    name: 'Shift Leadership Circle',
    description: 'Shift in-charges and supervisors across all plants: handovers, rosters, people and escalation.',
    domain: 'Leadership',
    organizers: managers,
    autoJoin: { roles: ['shift_incharge', 'supervisor'] },
  });
  circles.push({
    slug: 'safety-circle',
    name: 'Safety Circle',
    description: 'Site safety for everyone: LOTO, PPE, chemical handling, confined space, near-miss learnings.',
    domain: 'Safety',
    organizers: managers,
    autoJoin: { roles: ALL_ROLES },
  });
  for (const c of circles) {
    const id = `com-${c.slug}`;
    log(`${c.name} — organizers ${c.organizers.join(', ') || '(none)'} — auto-join ${JSON.stringify(c.autoJoin)}`);
    if (APPLY) {
      await Community.updateOne(
        { id },
        {
          $setOnInsert: {
            id,
            slug: c.slug,
            name: c.name,
            description: c.description,
            domain: c.domain,
            organizerEmployeeIds: c.organizers,
            memberEmployeeIds: [],
            optedOutEmployeeIds: [],
            autoJoin: c.autoJoin,
          },
        },
        { upsert: true },
      );
    }
  }

  // 3. Events, RSVPs, posts
  console.log('\n3. Events');
  const now = Date.now();
  for (const s of sessions) {
    const hostId = mentorEmpIdBySession.get(s.id);
    if (!hostId) continue;
    const created = (s as unknown as { createdAt?: Date }).createdAt;
    const when = parseScheduledAt(s.scheduledAt, created ? new Date(created).getFullYear() : new Date().getFullYear());
    if (!when) {
      skipped.push(`Session ${s.id} — "${s.scheduledAt}" isn't a real date; the host should re-create it`);
      continue;
    }
    const past = Date.parse(when.endsAt) < now;
    const host = empById.get(hostId);
    const plant = host?.siteId ? siteById.get(host.siteId)?.plantType : undefined;
    const eventId = `evt-${s.id}`;
    const realEnrolled = s.enrolledEmployeeIds.filter((id) => empById.has(id) && id !== hostId);
    log(
      `${s.topic.slice(0, 60)}… — ${when.startsAt} — host ${hostId} — ${past ? 'completed' : 'published'} — ` +
        `${realEnrolled.length} RSVPs (stored count ${s.registeredCount} ignored), ${s.questions.length} questions`,
    );
    if (!APPLY) continue;
    await Event.updateOne(
      { id: eventId },
      {
        $setOnInsert: {
          id: eventId,
          communityId: plant ? communityByPlant.get(plant) : undefined,
          type: 'masterclass',
          title: s.topic,
          description: s.description,
          agenda: [],
          topics: [],
          audience: {},
          hostEmployeeIds: [hostId],
          startsAt: when.startsAt,
          endsAt: when.endsAt,
          format: 'online',
          meetLink: s.meetingLink ?? '',
          capacity: s.maxCapacity,
          waitlistEnabled: true,
          status: past ? 'completed' : 'published',
          // Past events: don't send reminders or feedback requests for them now
          remindersSent: past ? ['roster', '1d', '1h', 'start', 'feedback'] : [],
        },
      },
      { upsert: true },
    );
    const rsvpAt = (created ? new Date(created) : new Date()).toISOString();
    for (const employeeId of realEnrolled) {
      await Rsvp.updateOne(
        { eventId, employeeId },
        { $setOnInsert: { id: `rsvp-${s.id}-${employeeId}`, eventId, employeeId, status: past ? 'attended' : 'going', rsvpAt } },
        { upsert: true },
      );
    }
    for (const q of s.questions) {
      if (!empById.has(q.employeeId)) continue;
      await Post.updateOne(
        { id: `post-${s.id}-${q.id}` },
        { $setOnInsert: { id: `post-${s.id}-${q.id}`, eventId, authorEmployeeId: q.employeeId, text: q.question, kind: 'question', pinned: false } },
        { upsert: true },
      );
    }
  }

  // 4. Course skills from ability titles
  console.log('\n4. Course skills');
  const courses = await Course.find({ $or: [{ skills: { $exists: false } }, { skills: { $size: 0 } }] }).lean();
  log(`${courses.length} courses get skills from their ability titles`);
  if (APPLY) {
    for (const c of courses) {
      const skills = [...new Set((c.abilities ?? []).map((a) => a.title?.trim()).filter(Boolean))];
      await Course.updateOne({ id: c.id }, { $set: { skills } });
    }
  }

  if (skipped.length) {
    console.log('\nSkipped (needs a decision):');
    skipped.forEach((s) => console.log(`  ! ${s}`));
  }
  console.log(APPLY ? '\nDone.\n' : '\nDry run only — nothing was written.\n');
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
