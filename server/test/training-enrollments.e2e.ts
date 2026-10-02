/**
 * End-to-end check of the learning path: enroll → abilities → skill map → written →
 * practical → oral → certificate, plus auto-resolving the manager's flag.
 * Run against the TEST server only (see training-events.e2e.ts for setup).
 */
const API = process.env.API ?? 'http://localhost:3011/api';
if (/localhost:3001/.test(API)) throw new Error('Point API at the test server, not the main one');

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};
async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, data };
}
const answersFor = (qs: any[], wrong = false) =>
  Object.fromEntries(qs.map((q) => [q.id, wrong ? q.options.find((o: any) => o.id !== q.correctOptionId)?.id : q.correctOptionId]));

const LEARNER = 'emp0129'; // Sanket Jagadale, manager emp0123
const MANAGER = 'emp0123';
const OTHER_MANAGER = 'emp0131';

const HR = 'emp0147';
const mkQ = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    text: `E2E question ${i + 1}`,
    options: [{ id: 'a', text: 'Right' }, { id: 'b', text: 'Wrong' }],
    correctOptionId: 'a',
    explanation: '',
  }));

async function main() {
  // The skill map / written gates need questions. The real courses have none yet,
  // so on the TEST database the course author (HR) adds some first.
  const noQs = await call('POST', '/training/enrollments', { employeeId: 'emp0130', courseId: 'course-etp-101' });
  const blocked = await call('POST', `/training/enrollments/${noQs.data.id}/skill-map`, { answers: {} });
  ok(blocked.status === 400, `gate blocked while questions are missing: "${blocked.data?.message}"`);
  ok((await call('PATCH', '/training/courses/course-etp-101/content', { actorId: 'emp0126', skillMappingQuestions: mkQ('sm', 2) })).status === 403, 'only HR / Director can author course content');
  const authored = await call('PATCH', '/training/courses/course-etp-101/content', {
    actorId: HR,
    skillMappingQuestions: mkQ('sm', 4),
    writtenTestQuestions: mkQ('wt', 4),
    certificateValidityMonths: 6,
  });
  ok(authored.status === 200 && authored.data.certificateValidityMonths === 6, 'HR adds questions and sets 6-month validity');

  const course = (await call('GET', '/training/courses/course-etp-101')).data;
  ok(course.abilities?.length > 0, `course ${course.code} has ${course.abilities.length} abilities`);
  const abilities = [...course.abilities].sort((a: any, b: any) => a.order - b.order);

  // Manager flags a weak topic that this course covers
  const topic = course.skills?.[0];
  const flag = await call('POST', '/training/assignments', { employeeIds: [LEARNER], assignedByEmployeeId: MANAGER, kind: 'suggested', skills: [topic], reason: 'Needs work on this' });
  ok(flag.status === 201, `manager flags skill "${topic}"`);

  const enr = (await call('POST', '/training/enrollments', { employeeId: LEARNER, courseId: course.id })).data;
  ok(enr.status === 'IN_PROGRESS', 'learner enrolls');
  const again = (await call('POST', '/training/enrollments', { employeeId: LEARNER, courseId: course.id })).data;
  ok(again.id === enr.id, 'enrolling again returns the same enrollment');

  if (abilities.length > 1) {
    const locked = await call('POST', `/training/enrollments/${enr.id}/video`, { abilityId: abilities[1].id, watchedPct: 95 });
    ok(locked.status === 400, 'ability 2 is locked until ability 1 is done');
  }

  const firstQuiz = abilities[0].microQuiz?.questions;
  if (firstQuiz?.length) {
    const failQuiz = (await call('POST', `/training/enrollments/${enr.id}/quiz`, { abilityId: abilities[0].id, answers: answersFor(firstQuiz, true) })).data;
    ok(failQuiz.passed === false && failQuiz.scorePct < 100, `wrong answers fail the quiz (${failQuiz.scorePct}%)`);
  }

  for (const a of abilities) {
    await call('POST', `/training/enrollments/${enr.id}/video`, { abilityId: a.id, watchedPct: 95 });
    await call('POST', `/training/enrollments/${enr.id}/reading`, { abilityId: a.id });
    if (a.microQuiz?.questions?.length) {
      const q = (await call('POST', `/training/enrollments/${enr.id}/quiz`, { abilityId: a.id, answers: answersFor(a.microQuiz.questions) })).data;
      if (!q.passed) ok(false, `quiz ${a.id} should pass`);
    }
  }
  const afterAbilities = (await call('GET', `/training/enrollments?employeeId=${LEARNER}&courseId=${course.id}`)).data[0];
  ok(abilities.every((a: any) => afterAbilities.abilityProgress[a.id]?.completedAt), 'all abilities completed, server-scored');
  if (firstQuiz?.length) ok(afterAbilities.abilityProgress[abilities[0].id].quizAttempts === 2, 'quiz attempts counted (fail + pass)');

  const writtenEarly = await call('POST', `/training/enrollments/${enr.id}/written`, { answers: {} });
  ok(writtenEarly.status === 400, 'written test needs the skill map first');

  const sm = (await call('POST', `/training/enrollments/${enr.id}/skill-map`, { answers: answersFor(course.skillMappingQuestions) })).data;
  ok(sm.result?.passed && sm.enrollment.status === 'SKILL_MAP_DONE', `gate 1 skill map passed (${sm.result?.scorePct}%)`);
  const wr = (await call('POST', `/training/enrollments/${enr.id}/written`, { answers: answersFor(course.writtenTestQuestions) })).data;
  ok(wr.result?.passed, `gate 2 written passed (${wr.result?.scorePct}%)`);

  const pending = (await call('GET', `/training/pending-evaluations?evaluatorId=${MANAGER}`)).data;
  ok(pending.some((p: any) => p.enrollment.id === enr.id && p.needs === 'practical'), "learner appears in the manager's pending practicals");
  const otherPending = (await call('GET', `/training/pending-evaluations?evaluatorId=${OTHER_MANAGER}`)).data;
  ok(!otherPending.some((p: any) => p.enrollment.id === enr.id), "and not in another plant manager's queue");

  const scores = abilities.map((a: any) => ({ abilityId: a.id, abilityTitle: a.title, score: 4, remark: 'Good' }));
  const wrongEval = await call('POST', `/training/enrollments/${enr.id}/practical`, { evaluatorId: OTHER_MANAGER, scores });
  ok(wrongEval.status === 403, 'another plant manager cannot score the practical');
  const oralEarly = await call('POST', `/training/enrollments/${enr.id}/oral`, { evaluatorId: MANAGER, scores });
  ok(oralEarly.status === 400, 'oral needs the practical first');
  const pr = (await call('POST', `/training/enrollments/${enr.id}/practical`, { evaluatorId: MANAGER, scores, notes: 'Steady hands' })).data;
  ok(pr.result?.overallPct === 80 && pr.enrollment.status === 'PRACTICAL_DONE', 'gate 3 practical scored (4/5 → 80%)');
  const or = (await call('POST', `/training/enrollments/${enr.id}/oral`, { evaluatorId: MANAGER, scores })).data;
  ok(or.certificate?.certificateNo && or.enrollment.status === 'CERTIFIED', `gate 4 oral → certificate ${or.certificate?.certificateNo}`);

  const months = (Date.parse(or.certificate.expiresAt) - Date.parse(or.certificate.issuedAt)) / (30.44 * 24 * 3600_000);
  ok(Math.round(months) === (course.certificateValidityMonths || 12), `certificate valid ${Math.round(months)} months (course setting)`);
  const expected = Math.round((sm.result.scorePct * 0.25 + wr.result.scorePct * 0.25 + 80 * 0.3 + 80 * 0.2) * 10) / 10;
  ok(or.certificate.overallPct === expected, `weighted overall ${or.certificate.overallPct}% (25/25/30/20)`);

  const certs = (await call('GET', `/training/certificates?employeeId=${LEARNER}`)).data;
  ok(certs.some((c: any) => c.id === or.certificate.id), 'certificate stored in the database');

  const notes = (await call('GET', `/notifications?employeeId=${LEARNER}`)).data;
  ok(notes.some((n: any) => n.kind === 'training_certified'), 'learner notified of the certificate');
  const flags = (await call('GET', `/training/assignments?employeeId=${LEARNER}&assignedBy=${MANAGER}`)).data;
  ok(flags.find((f: any) => f.id === flag.data[0].id)?.status === 'resolved', "the manager's flag auto-resolved");
  const mgrNotes = (await call('GET', `/notifications?employeeId=${MANAGER}`)).data;
  ok(mgrNotes.some((n: any) => n.kind === 'training_flag_resolved' && n.meta?.assignmentId === flag.data[0].id), 'manager notified that the flag is resolved');

  // Migrated record: Rohit is at PRACTICAL_DONE → oral completes him
  const rohit = (await call('GET', '/training/enrollments?employeeId=emp0127&courseId=course-etp-101')).data[0];
  ok(rohit?.status === 'PRACTICAL_DONE', 'migrated training_record became an enrollment (Rohit, practical done)');

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
