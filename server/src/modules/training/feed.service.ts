import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Certificate,
  CertificateDocument,
  Course,
  CourseDocument,
  Enrollment,
  EnrollmentDocument,
  RolePath,
  RolePathDocument,
  TrainingAssignment,
  TrainingAssignmentDocument,
} from '../../../db/schemas/training';
import { PeopleService, Person } from './people.service';
import { EventsService } from './events.service';

const OPEN = ['open', 'in_progress', 'assigned'];
const ROLE_LABEL: Record<string, string> = {
  employee: 'Plant Operators',
  shift_incharge: 'Shift In-Charges',
  supervisor: 'Site Managers',
  safety_incharge: 'Safety In-Charges',
  site_incharge: 'Site In-Charges',
  manager: 'Plant Managers',
  hr: 'HR',
  director: 'Directors',
};

/** Which plant a course belongs to (sites.plantType), from its audience or section. */
const coursePlant = (c: Course): string | undefined => {
  if (c.audience?.plantTypes?.length) return c.audience.plantTypes[0];
  const s = `${c.section ?? ''} ${c.category ?? ''}`;
  if (/ETP|Effluent/i.test(s)) return 'ETP';
  if (/WTP|Water Treatment|RO\b|Membrane/i.test(s)) return 'RO';
  if (/ZLD|Zero Liquid|MEE/i.test(s)) return 'MEE';
  return undefined;
};

/** Card fields only (no question banks). */
export const courseCard = (c: Course) => ({
  id: c.id,
  code: c.code,
  title: c.title,
  description: c.description,
  section: c.section,
  thumbnailUrl: c.thumbnailUrl,
  provider: c.provider,
  rating: c.rating,
  reviewCount: c.reviewCount,
  level: c.level,
  estimatedHours: c.estimatedHours,
  skills: c.skills ?? [],
  abilityCount: c.abilities?.length ?? 0,
  moduleCount: c.modules?.length ?? 0,
  certificateValidityMonths: c.certificateValidityMonths ?? 12,
  type: c.type ?? 'course',
});
export type CourseCard = ReturnType<typeof courseCard>;

type Reason = { text: string; weight: number };

/**
 * Explainable recommendations and the personal Home feed (plan §2.1 and §4).
 * Every number shown comes from the database; nothing is invented.
 */
@Injectable()
export class FeedService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Certificate.name) private certModel: Model<CertificateDocument>,
    @InjectModel(TrainingAssignment.name) private assignmentModel: Model<TrainingAssignmentDocument>,
    @InjectModel(RolePath.name) private rolePathModel: Model<RolePathDocument>,
    private readonly people: PeopleService,
    private readonly events: EventsService,
  ) {}

  private async context(employeeId: string) {
    const me = await this.people.one(employeeId);
    if (!me) throw new NotFoundException(`Person ${employeeId} not found`);
    const [courses, enrollments, certs, assignments, paths, everyone] = await Promise.all([
      this.courseModel.find().lean().exec(),
      this.enrollmentModel.find().lean().exec(),
      this.certModel.find({ employeeId }).lean().exec(),
      this.assignmentModel.find({ employeeId, status: { $in: OPEN } }).sort({ dueDate: 1 }).lean().exec(),
      this.rolePathModel.find({ role: me.role }).lean().exec(),
      this.people.all(),
    ]);
    const paths2 = paths.filter(
      (p) => (!p.designation || p.designation === me.designation) && (!p.plantType || p.plantType === me.plantType),
    );
    return { me, courses, enrollments, certs, assignments, paths: paths2, everyone };
  }

  private recommend(ctx: Awaited<ReturnType<FeedService['context']>>) {
    const { me, courses, enrollments, certs, assignments, paths, everyone } = ctx;
    const mine = new Map(enrollments.filter((e) => e.employeeId === me.id).map((e) => [e.courseId, e]));
    const now = Date.now();
    const validCert = new Map(
      certs.filter((c) => !c.expiresAt || Date.parse(c.expiresAt) > now).map((c) => [c.courseId, c]),
    );
    const mandatory = new Set(assignments.filter((a) => a.kind !== 'suggested' && a.courseId).map((a) => a.courseId!));
    const suggestions = assignments.filter((a) => a.kind === 'suggested');
    const required = new Set(paths.flatMap((p) => p.steps.filter((s) => s.mandatory).map((s) => s.courseId)));
    const peers = new Set(everyone.filter((p) => p.id !== me.id && p.role === me.role && p.siteId === me.siteId).map((p) => p.id));
    const certifiedIds = new Set(certs.map((c) => c.courseId));

    const out: Array<{ course: CourseCard; score: number; reasons: string[]; reason: string; suggestedBy?: string }> = [];
    for (const c of courses) {
      const enr = mine.get(c.id);
      const cert = validCert.get(c.id);
      const expiringSoon = cert?.expiresAt && Date.parse(cert.expiresAt) - now < 60 * 86_400_000;
      if (mandatory.has(c.id)) continue; // shown in "Assigned to you"
      if (enr && enr.status !== 'CERTIFIED') continue; // shown in "Continue learning"
      if (cert && !expiringSoon) continue; // already certified and valid
      if (c.audience?.roles?.length && !c.audience.roles.includes(me.role)) continue;

      const reasons: Reason[] = [];
      const skills = (c.skills ?? []).map((s) => s.toLowerCase());
      let suggestedBy: string | undefined;
      for (const s of suggestions) {
        const hit =
          s.courseId === c.id ||
          (s.skills ?? []).some((k) => skills.includes(k.toLowerCase())) ||
          (s.topic && `${c.title} ${skills.join(' ')}`.toLowerCase().includes(s.topic.toLowerCase()));
        if (hit) {
          suggestedBy = s.assignedByName;
          reasons.push({ text: `Suggested by ${s.assignedByName}${s.topic ? `: ${s.topic}` : ''}`, weight: 100 });
          break;
        }
      }
      if (required.has(c.id) && !certifiedIds.has(c.id)) reasons.push({ text: `Required for ${ROLE_LABEL[me.role] ?? me.role}`, weight: 80 });
      const low = enr && (['skillMap', 'written'] as const).find((g) => enr.assessments?.[g] && !enr.assessments[g]!.passed);
      if (enr && low) reasons.push({ text: `Your ${low === 'skillMap' ? 'skill map' : 'written'} score was ${enr.assessments[low]!.scorePct}%`, weight: 50 });
      if (expiringSoon) reasons.push({ text: `Your certificate expires on ${cert!.expiresAt!.slice(0, 10)}. Renew it`, weight: 45 });
      if (me.plantType && coursePlant(c) === me.plantType) reasons.push({ text: `Used at your plant (${me.siteName ?? me.plantType})`, weight: 25 });
      const prereqDone = (c.prerequisites ?? []).filter((p) => certifiedIds.has(p));
      if (prereqDone.length) {
        const code = courses.find((x) => x.id === prereqDone[0])?.code;
        reasons.push({ text: `Next after ${code ?? prereqDone[0]}`, weight: 20 });
      }
      const peerCount = enrollments.filter((e) => e.courseId === c.id && peers.has(e.employeeId)).length;
      if (peerCount) reasons.push({ text: `${peerCount} ${ROLE_LABEL[me.role] ?? 'colleagues'} at ${me.siteName ?? 'your site'} took this`, weight: 10 });

      if (!reasons.length) continue;
      reasons.sort((a, b) => b.weight - a.weight);
      out.push({
        course: courseCard(c),
        score: reasons.reduce((s, r) => s + r.weight, 0),
        reasons: reasons.map((r) => r.text),
        reason: reasons[0].text,
        suggestedBy,
      });
    }
    return out.sort((a, b) => b.score - a.score || (b.course.rating ?? 0) - (a.course.rating ?? 0));
  }

  async recommendations(employeeId: string) {
    return this.recommend(await this.context(employeeId));
  }

  /** Everything the personal Training Home needs, in one call. */
  async home(employeeId: string) {
    const ctx = await this.context(employeeId);
    const { me, courses, enrollments, certs, assignments, paths, everyone } = ctx;
    const byId = new Map(courses.map((c) => [c.id, c]));
    const mine = enrollments.filter((e) => e.employeeId === me.id);
    const progress = (e: Enrollment) => {
      const c = byId.get(e.courseId);
      const total = c?.abilities?.length ?? 0;
      const done = c ? c.abilities.filter((a) => e.abilityProgress?.[a.id]?.completedAt).length : 0;
      return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
    };
    const enrollmentFor = (courseId?: string) => mine.find((e) => e.courseId === courseId);

    const assigned = assignments
      .filter((a) => a.kind !== 'suggested' && a.courseId && byId.has(a.courseId))
      .map((a) => {
        const e = enrollmentFor(a.courseId);
        return {
          assignment: a,
          course: courseCard(byId.get(a.courseId!)!),
          enrollment: e ? { id: e.id, status: e.status, ...progress(e) } : undefined,
          overdue: Boolean(a.dueDate && a.dueDate < new Date().toISOString().slice(0, 10)),
        };
      });

    const continueLearning = mine
      .filter((e) => e.status !== 'CERTIFIED' && byId.has(e.courseId))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((e) => ({ course: courseCard(byId.get(e.courseId)!), enrollment: { id: e.id, status: e.status, ...progress(e) } }));

    const certified = new Set(certs.map((c) => c.courseId));
    const requiredPaths = paths.map((p) => ({
      id: p.id,
      title: p.title,
      steps: [...p.steps]
        .sort((a, b) => a.order - b.order)
        .filter((s) => byId.has(s.courseId))
        .map((s) => ({ ...s, course: courseCard(byId.get(s.courseId)!), certified: certified.has(s.courseId) })),
    }));

    // Popular at your site: most-enrolled courses among people with the same role at the same site
    const peers = new Set(everyone.filter((p) => p.id !== me.id && p.siteId === me.siteId && p.role === me.role).map((p) => p.id));
    const counts = new Map<string, number>();
    for (const e of enrollments) if (peers.has(e.employeeId)) counts.set(e.courseId, (counts.get(e.courseId) ?? 0) + 1);
    const popularAtSite = [...counts.entries()]
      .filter(([id]) => byId.has(id) && !enrollmentFor(id))
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => ({ course: courseCard(byId.get(id)!), learners: n }));

    const upcomingEvents = await this.events.list({ viewerId: me.id, view: 'upcoming' });

    // Open weak-area flags, shown even when no course matches by name
    const recommended = this.recommend(ctx);
    const suggestions = assignments
      .filter((a) => a.kind === 'suggested')
      .map((a) => ({
        assignment: a,
        course: a.courseId && byId.has(a.courseId) ? courseCard(byId.get(a.courseId)!) : undefined,
        matches: recommended.filter((r) => r.suggestedBy === a.assignedByName).slice(0, 3).map((r) => r.course),
      }));

    return {
      me: me as Person,
      suggestions,
      stats: {
        assigned: assigned.length,
        inProgress: continueLearning.length,
        certified: certs.filter((c) => !c.expiresAt || Date.parse(c.expiresAt) > Date.now()).length,
      },
      assigned,
      continueLearning,
      recommended,
      requiredPaths,
      upcomingEvents: upcomingEvents.filter((e) => e.status === 'published'),
      popularAtSite,
    };
  }

  /** Catalog for Explore: card fields plus the viewer's state per course. */
  async catalog(employeeId?: string) {
    const courses = await this.courseModel.find().sort({ code: 1 }).lean().exec();
    const mine = employeeId ? await this.enrollmentModel.find({ employeeId }).lean().exec() : [];
    const certs = employeeId ? await this.certModel.find({ employeeId }).lean().exec() : [];
    return courses.map((c) => {
      const e = mine.find((x) => x.courseId === c.id);
      const done = e ? c.abilities.filter((a) => e.abilityProgress?.[a.id]?.completedAt).length : 0;
      return {
        ...courseCard(c),
        abilityTitles: c.abilities.map((a) => a.title),
        plantType: coursePlant(c),
        myStatus: certs.some((x) => x.courseId === c.id) ? 'CERTIFIED' : e?.status,
        myProgressPct: e && c.abilities.length ? Math.round((done / c.abilities.length) * 100) : undefined,
      };
    });
  }
}
