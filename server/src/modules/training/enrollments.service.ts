import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AbilityProgress,
  AbilityScore,
  Certificate,
  CertificateDocument,
  Course,
  CourseDocument,
  Enrollment,
  EnrollmentDocument,
  EvaluationResult,
  QuizResult,
  TrainingAssignment,
  TrainingAssignmentDocument,
} from '../../../db/schemas/training';
import { Site, SiteDocument } from '../../../db/schemas/site.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { PeopleService } from './people.service';

type Ability = Course['abilities'][number];
type Question = { id: string; correctOptionId: string };

const nowIso = () => new Date().toISOString();
const freshProgress = (abilityId: string, unlocked: boolean): AbilityProgress => ({
  abilityId,
  videoWatchedPct: 0,
  videoComplete: false,
  readingAcknowledged: false,
  quizAttempts: 0,
  quizPassed: false,
  unlockedAt: unlocked ? nowIso() : '',
});
const score = (questions: Question[], answers: Record<string, string>) => {
  if (!questions.length) return 0;
  const correct = questions.filter((q) => answers?.[q.id] === q.correctOptionId).length;
  return Math.round((correct / questions.length) * 100);
};
/** Practical / oral: 1–5 rubric per ability → percentage, one decimal. */
const rubricPct = (scores: AbilityScore[]) =>
  scores.length ? Math.round((scores.reduce((s, x) => s + x.score, 0) / (scores.length * 5)) * 1000) / 10 : 0;
const OPEN_ASSIGNMENT = ['open', 'in_progress', 'assigned'];

/**
 * Learning progress and the 4 assessment gates, scored on the server.
 * Gates: Skill Map (25%) + Written (25%) + Practical (30%) + Oral (20%) → certificate.
 * Event attendance is a training stage only (see EventsService.trainingHours), never a gate.
 */
@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Certificate.name) private certModel: Model<CertificateDocument>,
    @InjectModel(TrainingAssignment.name) private assignmentModel: Model<TrainingAssignmentDocument>,
    @InjectModel(Site.name) private siteModel: Model<SiteDocument>,
    private readonly people: PeopleService,
    private readonly notifications: NotificationsService,
  ) {}

  private async course(courseId: string): Promise<Course> {
    const c = await this.courseModel.findOne({ $or: [{ id: courseId }, { code: courseId }] }).lean().exec();
    if (!c) throw new NotFoundException(`Course ${courseId} not found`);
    return c;
  }

  private async load(id: string): Promise<EnrollmentDocument> {
    const e = await this.enrollmentModel.findOne({ id }).exec();
    if (!e) throw new NotFoundException(`Enrollment ${id} not found`);
    return e;
  }

  private async save(e: EnrollmentDocument) {
    e.markModified('abilityProgress');
    e.markModified('assessments');
    await e.save();
    return e.toObject();
  }

  list(q: { employeeId?: string; courseId?: string; employeeIds?: string[] }) {
    const filter: Record<string, unknown> = {};
    if (q.employeeId) filter.employeeId = q.employeeId;
    if (q.employeeIds?.length) filter.employeeId = { $in: q.employeeIds };
    if (q.courseId) filter.courseId = q.courseId;
    return this.enrollmentModel.find(filter).lean().exec();
  }

  /** Get-or-create (enrolling is idempotent). */
  async enroll(employeeId: string, courseId: string) {
    if (!employeeId || !courseId) throw new BadRequestException('employeeId and courseId are required');
    const course = await this.course(courseId);
    if (!(await this.people.one(employeeId))) throw new BadRequestException(`Employee ${employeeId} not found`);
    const existing = await this.enrollmentModel.findOne({ employeeId, courseId: course.id }).lean().exec();
    if (existing) return existing;
    const abilityProgress: Record<string, AbilityProgress> = {};
    for (const a of course.abilities) abilityProgress[a.id] = freshProgress(a.id, a.order === 1);
    const doc = await this.enrollmentModel.create({
      id: `enr-${employeeId}-${course.id}`,
      employeeId,
      courseId: course.id,
      status: 'IN_PROGRESS',
      startedAt: nowIso(),
      abilityProgress,
      assessments: {},
    });
    await this.assignmentModel
      .updateMany({ employeeId, courseId: course.id, status: { $in: ['open', 'assigned'] } }, { status: 'in_progress' })
      .exec();
    return doc.toObject();
  }

  private progressOf(e: Enrollment, abilityId: string) {
    return (e.abilityProgress[abilityId] ??= freshProgress(abilityId, true));
  }

  private assertUnlocked(e: Enrollment, course: Course, ability: Ability) {
    if (ability.order === 1) return;
    const prev = course.abilities.find((a) => a.order === ability.order - 1);
    if (prev && !e.abilityProgress[prev.id]?.completedAt) {
      throw new BadRequestException('Finish the previous ability first');
    }
  }

  /** Abilities without a quiz complete once the video is watched (and the reading acknowledged, if there is one). */
  private completeIfNoQuiz(e: Enrollment, course: Course, ability: Ability) {
    if (ability.microQuiz?.questions?.length) return;
    const p = this.progressOf(e, ability.id);
    const readingOk = !ability.readingContent || p.readingAcknowledged;
    if (p.videoComplete && readingOk && !p.completedAt) {
      p.completedAt = nowIso();
      const next = course.abilities.find((a) => a.order === ability.order + 1);
      if (next) this.progressOf(e, next.id).unlockedAt ||= nowIso();
    }
  }

  async videoProgress(id: string, abilityId: string, watchedPct: number) {
    const e = await this.load(id);
    const course = await this.course(e.courseId);
    const ability = course.abilities.find((a) => a.id === abilityId);
    if (!ability) throw new BadRequestException('Ability not found');
    this.assertUnlocked(e, course, ability);
    const p = this.progressOf(e, abilityId);
    p.videoWatchedPct = Math.min(100, Math.max(p.videoWatchedPct, Math.round(Number(watchedPct) || 0)));
    if (p.videoWatchedPct >= 90) p.videoComplete = true;
    this.completeIfNoQuiz(e, course, ability);
    return this.save(e);
  }

  async acknowledgeReading(id: string, abilityId: string) {
    const e = await this.load(id);
    const course = await this.course(e.courseId);
    const ability = course.abilities.find((a) => a.id === abilityId);
    if (!ability) throw new BadRequestException('Ability not found');
    this.progressOf(e, abilityId).readingAcknowledged = true;
    this.completeIfNoQuiz(e, course, ability);
    return this.save(e);
  }

  async microQuiz(id: string, abilityId: string, answers: Record<string, string>) {
    const e = await this.load(id);
    const course = await this.course(e.courseId);
    const ability = course.abilities.find((a) => a.id === abilityId);
    if (!ability?.microQuiz?.questions?.length) throw new BadRequestException('This ability has no quiz');
    this.assertUnlocked(e, course, ability);
    const scorePct = score(ability.microQuiz.questions, answers);
    const passed = scorePct >= ability.microQuiz.passThreshold;
    const p = this.progressOf(e, abilityId);
    p.quizAttempts += 1;
    p.quizScorePct = scorePct;
    if (passed) {
      p.quizPassed = true;
      p.completedAt ??= nowIso();
      const next = course.abilities.find((a) => a.order === ability.order + 1);
      if (next) this.progressOf(e, next.id).unlockedAt ||= nowIso();
    }
    return { scorePct, passed, enrollment: await this.save(e) };
  }

  private allAbilitiesDone(e: Enrollment, course: Course) {
    return course.abilities.length > 0 && course.abilities.every((a) => e.abilityProgress[a.id]?.completedAt);
  }

  private async quizGate(id: string, gate: 'skillMap' | 'written', answers: Record<string, string>) {
    const e = await this.load(id);
    const course = await this.course(e.courseId);
    if (!this.allAbilitiesDone(e, course)) throw new BadRequestException('Finish every ability first');
    if (gate === 'written' && !e.assessments.skillMap?.passed) throw new BadRequestException('Pass the skill map first');
    const questions = (gate === 'skillMap' ? course.skillMappingQuestions : course.writtenTestQuestions) ?? [];
    if (!questions.length) {
      throw new BadRequestException(
        `The ${gate === 'skillMap' ? 'skill mapping' : 'written'} questions for this course are not set up yet`,
      );
    }
    const scorePct = score(questions, answers);
    const result: QuizResult = {
      id: `${gate === 'skillMap' ? 'smr' : 'wtr'}-${Date.now()}`,
      enrollmentId: id,
      scorePct,
      passed: scorePct >= (course.passThreshold ?? 70),
      takenAt: nowIso(),
      answers,
    };
    e.assessments = { ...e.assessments, [gate]: result };
    if (gate === 'skillMap' && result.passed && e.status === 'IN_PROGRESS') e.status = 'SKILL_MAP_DONE';
    await this.save(e);
    const certificate = await this.tryCertify(id);
    return { result, certificate, enrollment: (await this.enrollmentModel.findOne({ id }).lean().exec())! };
  }

  skillMap(id: string, answers: Record<string, string>) {
    return this.quizGate(id, 'skillMap', answers);
  }

  written(id: string, answers: Record<string, string>) {
    return this.quizGate(id, 'written', answers);
  }

  /** Practical / oral: scored on site by the Director or the learner's allotted manager. */
  async evaluate(
    id: string,
    gate: 'practical' | 'oral',
    body: { evaluatorId: string; scores: AbilityScore[]; notes?: string },
  ) {
    const e = await this.load(id);
    const [evaluator, learner] = [await this.people.one(body.evaluatorId), await this.people.one(e.employeeId)];
    if (!evaluator) throw new BadRequestException('Evaluator not found');
    if (evaluator.role !== 'director' && learner?.managerId !== evaluator.id) {
      throw new ForbiddenException(`${evaluator.name} is not ${learner?.name ?? 'this employee'}'s manager`);
    }
    if (!e.assessments.skillMap?.passed) throw new BadRequestException('The learner has not passed the skill map yet');
    if (gate === 'oral' && !e.assessments.practical) throw new BadRequestException('Score the practical first');
    const scores = (body.scores ?? []).filter((s) => s.score >= 1 && s.score <= 5);
    if (!scores.length) throw new BadRequestException('Give a 1–5 score for at least one ability');
    const result: EvaluationResult = {
      id: `${gate === 'practical' ? 'ptr' : 'otr'}-${Date.now()}`,
      enrollmentId: id,
      evaluatorId: evaluator.id,
      evaluatorName: `${evaluator.name}${evaluator.designation ? ` (${evaluator.designation})` : ''}`,
      scores,
      overallPct: rubricPct(scores),
      conductedAt: nowIso(),
      ...(gate === 'practical' ? { signatureVerified: true, generalNotes: body.notes } : { interviewNotes: body.notes, generalNotes: body.notes }),
    };
    e.assessments = { ...e.assessments, [gate]: result };
    if (gate === 'practical' && e.status === 'SKILL_MAP_DONE') e.status = 'PRACTICAL_DONE';
    if (gate === 'oral' && e.status === 'PRACTICAL_DONE') e.status = 'ORAL_DONE';
    await this.save(e);
    const certificate = await this.tryCertify(id);
    return { result, certificate, enrollment: (await this.enrollmentModel.findOne({ id }).lean().exec())! };
  }

  /** All 4 gates passed → issue the certificate (validity from the course), resolve matching assignments. */
  private async tryCertify(id: string): Promise<Certificate | null> {
    const e = await this.load(id);
    const a = e.assessments;
    if (!a.skillMap?.passed || !a.written?.passed || !a.practical || !a.oral) return null;
    const existing = await this.certModel.findOne({ enrollmentId: id }).lean().exec();
    if (existing) return existing;

    const course = await this.course(e.courseId);
    const learner = await this.people.one(e.employeeId);
    const overallPct =
      Math.round((a.skillMap.scorePct * 0.25 + a.written.scorePct * 0.25 + a.practical.overallPct * 0.3 + a.oral.overallPct * 0.2) * 10) / 10;
    const issued = new Date();
    const expires = new Date(issued);
    expires.setMonth(expires.getMonth() + (course.certificateValidityMonths || 12));
    const site = learner?.siteId ? await this.siteModel.findOne({ id: learner.siteId }).lean().exec() : null;
    const signatory = site?.managerName ? `${site.managerName} (${site.name} Manager)` : a.practical.evaluatorName;
    const count = await this.certModel.countDocuments({ certificateNo: { $regex: `^NEIPL-CERT-${issued.getFullYear()}-` } });

    const cert = (
      await this.certModel.create({
        id: `cert-${e.id}`,
        certificateNo: `NEIPL-CERT-${issued.getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        enrollmentId: id,
        employeeId: e.employeeId,
        employeeName: learner?.name ?? e.employeeId,
        courseId: course.id,
        courseTitle: course.title,
        issuedAt: issued.toISOString(),
        expiresAt: expires.toISOString(),
        overallPct,
        skillMapPct: a.skillMap.scorePct,
        writtenPct: a.written.scorePct,
        practicalPct: a.practical.overallPct,
        oralPct: a.oral.overallPct,
        managerSignatory: signatory,
        verificationHash: `SHA256-${Buffer.from(`${e.id}|${issued.toISOString()}|${overallPct}`).toString('base64').replace(/[^A-Z0-9]/gi, '').slice(0, 24).toUpperCase()}`,
        status: 'active',
      })
    ).toObject();

    e.status = 'CERTIFIED';
    e.completedAt = issued.toISOString();
    await this.save(e);

    await this.notifications.notify({
      employeeId: e.employeeId,
      kind: 'training_certified',
      title: `Certified: ${course.title}`,
      body: `Overall ${overallPct}%. Valid until ${expires.toISOString().slice(0, 10)}.`,
      href: '/certifications',
      meta: { certificateId: cert.id },
    });
    await this.resolveAssignments(e.employeeId, course);
    return cert;
  }

  /** A certificate closes the learner's open assignments for this course, and suggested flags whose skills it covers. */
  private async resolveAssignments(employeeId: string, course: Course) {
    const open = await this.assignmentModel.find({ employeeId, status: { $in: OPEN_ASSIGNMENT } }).lean().exec();
    const skills = new Set((course.skills ?? []).map((s) => s.toLowerCase()));
    const matches = open.filter(
      (x) =>
        x.courseId === course.id ||
        (!x.courseId && (x.skills ?? []).some((s) => skills.has(s.toLowerCase()))) ||
        (!x.courseId && x.topic && [...skills].some((s) => s.includes(x.topic!.toLowerCase()))),
    );
    const learner = await this.people.one(employeeId);
    for (const x of matches) {
      await this.assignmentModel.updateOne({ id: x.id }, { status: 'resolved', resolvedAt: nowIso(), resolvedBy: 'system' }).exec();
      await this.notifications.notify({
        employeeId: x.assignedByEmployeeId,
        kind: 'training_flag_resolved',
        title: `${learner?.name ?? employeeId} completed: ${x.topic || course.title}`,
        body: `Certified in ${course.title}. Your note: ${x.reason}`,
        href: `/employees/${employeeId}`,
        meta: { assignmentId: x.id },
      });
    }
  }

  /** Learners waiting for an on-site practical or oral, for an evaluator's people (or a site). */
  async pendingEvaluations(q: { evaluatorId?: string; siteId?: string }) {
    const people = await this.people.all();
    const evaluator = q.evaluatorId ? await this.people.one(q.evaluatorId) : undefined;
    const scope = people.filter(
      (p) =>
        (!q.siteId || p.siteId === q.siteId) &&
        (!evaluator || evaluator.role === 'director' || p.managerId === evaluator.id),
    );
    const byId = new Map(scope.map((p) => [p.id, p]));
    const rows = await this.enrollmentModel
      .find({ employeeId: { $in: [...byId.keys()] }, status: { $in: ['SKILL_MAP_DONE', 'PRACTICAL_DONE', 'ORAL_DONE'] } })
      .lean()
      .exec();
    const courses = await this.courseModel.find({ id: { $in: rows.map((r) => r.courseId) } }).lean().exec();
    const courseById = new Map(courses.map((c) => [c.id, c]));
    return rows
      .filter((r) => !r.assessments.practical || !r.assessments.oral)
      .map((r) => ({
        enrollment: r,
        employee: byId.get(r.employeeId),
        course: courseById.get(r.courseId),
        needs: !r.assessments.practical ? 'practical' : 'oral',
      }));
  }
}
