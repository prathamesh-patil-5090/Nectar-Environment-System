/**
 * Convert training_records (old shape, never written by the client) into enrollments
 * (ability progress + the 4 assessment gates), so learning progress lives in the database.
 * Additive and idempotent: existing enrollments are left alone; training_records is not deleted.
 * Enrollment ids keep the record id, because certificates.enrollmentId already points at it.
 *
 *   npx ts-node db/migrations/2026-10-enrollments-from-records.ts           # dry run
 *   npx ts-node db/migrations/2026-10-enrollments-from-records.ts --apply
 */
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { CourseSchema, TrainingRecordSchema, EnrollmentSchema } from '../schemas/training';

const APPLY = process.argv.includes('--apply');
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'nectar_enviro';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { dbName: DB_NAME });
  console.log(`\nEnrollments from training_records on "${DB_NAME}" — ${APPLY ? 'APPLY' : 'DRY RUN (pass --apply to write)'}\n`);

  const Course = mongoose.model('Course', CourseSchema, 'courses');
  const Record = mongoose.model('TrainingRecord', TrainingRecordSchema, 'training_records');
  const Enrollment = mongoose.model('Enrollment', EnrollmentSchema, 'enrollments');

  const courses = new Map((await Course.find().lean()).map((c) => [c.id, c]));
  const records = await Record.find().lean();

  for (const r of records) {
    const course = courses.get(r.courseId);
    if (!course) {
      console.log(`  ! ${r.id}: course ${r.courseId} not found — skipped`);
      continue;
    }
    if (await Enrollment.exists({ $or: [{ id: r.id }, { employeeId: r.employeeId, courseId: course.id }] })) {
      console.log(`  = ${r.id}: already migrated`);
      continue;
    }
    const certified = r.status === 'certified';
    const done = (abilityId: string) => certified || Boolean(r.abilityProgress?.[abilityId]);
    const doneAt = r.completedAt ?? r.enrolledAt;
    const abilityProgress: Record<string, unknown> = {};
    const ordered = [...course.abilities].sort((a, b) => a.order - b.order);
    ordered.forEach((a, i) => {
      const isDone = done(a.id);
      const unlocked = i === 0 || done(ordered[i - 1].id);
      abilityProgress[a.id] = {
        abilityId: a.id,
        videoWatchedPct: isDone ? 100 : 0,
        videoComplete: isDone,
        readingAcknowledged: isDone,
        quizAttempts: isDone ? 1 : 0,
        quizPassed: isDone,
        unlockedAt: unlocked ? r.enrolledAt : '',
        ...(isDone ? { completedAt: doneAt } : {}),
      };
    });

    const pass = course.passThreshold ?? 70;
    const as = r.assessments ?? {};
    const quiz = (g?: { scorePct: number; conductedAt?: string }, prefix = 'q') =>
      g ? { id: `${prefix}-${r.id}`, enrollmentId: r.id, scorePct: g.scorePct, passed: g.scorePct >= pass, takenAt: g.conductedAt ?? r.enrolledAt, answers: {} } : undefined;
    const evaluation = (g: any, prefix: string) =>
      g
        ? {
            id: `${prefix}-${r.id}`,
            enrollmentId: r.id,
            evaluatorId: g.evaluatorId ?? '',
            evaluatorName: g.evaluatorName ?? '',
            scores: (g.scores ?? []).map((s: any) => ({ abilityId: s.abilityId, abilityTitle: s.abilityTitle ?? '', score: s.score, remark: s.remark ?? '' })),
            overallPct: g.scorePct,
            conductedAt: g.conductedAt ?? r.enrolledAt,
            generalNotes: g.generalNotes ?? g.interviewNotes,
            interviewNotes: g.interviewNotes,
          }
        : undefined;
    const assessments = {
      skillMap: quiz(as.skillMap, 'smr'),
      written: quiz(as.written, 'wtr'),
      practical: evaluation(as.practical, 'ptr'),
      oral: evaluation(as.oral, 'otr'),
    };
    const status = certified
      ? 'CERTIFIED'
      : assessments.oral
        ? 'ORAL_DONE'
        : assessments.practical
          ? 'PRACTICAL_DONE'
          : assessments.skillMap?.passed
            ? 'SKILL_MAP_DONE'
            : 'IN_PROGRESS';

    console.log(`  ${APPLY ? '✔' : '•'} ${r.id}: ${r.employeeId} · ${course.code} · ${status} · gates ${Object.entries(assessments).filter(([, v]) => v).map(([k]) => k).join('+') || 'none'}`);
    if (APPLY) {
      await Enrollment.create({
        id: r.id,
        employeeId: r.employeeId,
        courseId: course.id,
        status,
        startedAt: r.enrolledAt,
        ...(certified && r.completedAt ? { completedAt: r.completedAt } : {}),
        abilityProgress,
        assessments: Object.fromEntries(Object.entries(assessments).filter(([, v]) => v)),
      });
    }
  }
  console.log(APPLY ? '\nDone.\n' : '\nDry run only — nothing was written.\n');
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
