/**
 * End-to-end check of events, RSVP/waitlist, discussion, notifications and weak-area flags.
 * Run against a server pointed at a TEST database (never the main one):
 *
 *   npx ts-node db/scripts/copy-to-test-db.ts
 *   PORT=3011 MONGODB_DB_NAME=nectar_enviro_test EVENT_SCHEDULER=off node dist/src/main.js
 *   API=http://localhost:3011/api npx ts-node test/training-events.e2e.ts
 */
const API = process.env.API ?? 'http://localhost:3011/api';
if (/localhost:3001/.test(API)) throw new Error('Point API at the test server, not the main one');

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* text body (csv / ics) */
  }
  return { status: res.status, data };
}

const notes = async (employeeId: string) => (await call('GET', `/notifications?employeeId=${employeeId}`)).data as any[];
const latest = async (employeeId: string, kind: string) => (await notes(employeeId)).find((n) => n.kind === kind);

const HOST = 'emp0123'; // Anand Dakave, ETP Plant Manager, mentor
const A = 'emp0126'; // Shilpa Hotkar (manager emp0123)
const B = 'emp0127'; // Rohit Kumar Singh (manager emp0123)
const C = 'emp0128'; // Mohee Vinchu (manager emp0123)
const OUTSIDER = 'emp0129'; // Sanket Jagadale, not registered
const DIRECTOR = 'user:director@nectarenviro.com';

async function main() {
  const start = new Date(Date.now() + 3 * 24 * 3600_000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);

  // --- Create & publish ---
  const denied = await call('POST', '/training/events', { actorId: A, title: 'x', startsAt: start.toISOString(), endsAt: end.toISOString(), capacity: 2 });
  ok(denied.status === 403, 'non-mentor cannot create events');

  const noVenue = await call('POST', '/training/events', { actorId: HOST, title: 'x', format: 'in_person', startsAt: start.toISOString(), endsAt: end.toISOString(), capacity: 2 });
  ok(noVenue.status === 400, 'in-plant event without a plant is rejected');

  const created = await call('POST', '/training/events', {
    actorId: HOST,
    title: 'E2E Clarifier troubleshooting',
    description: 'Test event',
    communityId: 'com-etp-operators-circle',
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    capacity: 2,
    meetLink: 'https://meet.google.com/e2e-test',
    rsvpQuestion: 'What do you want to discuss?',
  });
  ok(created.status === 201 && created.data[0]?.status === 'draft', 'mentor creates a draft');
  const id = created.data[0].id;

  const pub = await call('POST', `/training/events/${id}/publish`, { actorId: HOST });
  ok(pub.data?.status === 'published', 'host publishes');
  ok(Boolean(await latest(OUTSIDER, 'event_published')), 'community member (ETP) is notified of the new event');

  // --- RSVP, capacity, waitlist ---
  const noAnswer = await call('POST', `/training/events/${id}/rsvp`, { employeeId: A });
  ok(noAnswer.status === 400, 'RSVP without answering the host question is rejected');

  const rA = await call('POST', `/training/events/${id}/rsvp`, { employeeId: A, answer: 'Sludge bulking' });
  ok(rA.data?.myRsvp?.status === 'going', 'A is going');
  const hostNote = await latest(HOST, 'event_rsvp_going');
  ok(hostNote && /Shilpa Hotkar/.test(hostNote.body) && /1\/2 going/.test(hostNote.body), `host notified instantly: "${hostNote?.body}"`);
  ok(Boolean(await latest(A, 'event_rsvp_confirmed')), 'A gets a confirmation');

  const rB = await call('POST', `/training/events/${id}/rsvp`, { employeeId: B, answer: 'Foaming' });
  ok(rB.data?.myRsvp?.status === 'going' && rB.data?.spotsLeft === 0, 'B is going, event full');

  const rC = await call('POST', `/training/events/${id}/rsvp`, { employeeId: C, answer: 'Polymer dose' });
  ok(rC.data?.myRsvp?.status === 'waitlist' && rC.data?.myRsvp?.waitlistPosition === 1, 'C joins the waitlist (#1)');
  ok(Boolean(await latest(HOST, 'event_waitlist_joined')), 'host notified of waitlist');

  // --- Meet link & attendee visibility ---
  ok((await call('GET', `/training/events/${id}?viewerId=${B}`)).data?.meetLink === 'https://meet.google.com/e2e-test', 'attendee sees the Meet link');
  ok(!(await call('GET', `/training/events/${id}?viewerId=${OUTSIDER}`)).data?.meetLink, 'non-attendee does not see the Meet link');
  ok((await call('GET', `/training/events/${id}/attendees?viewerId=${OUTSIDER}`)).status === 403, 'non-registered cannot see the attendee list');
  const asB = (await call('GET', `/training/events/${id}/attendees?viewerId=${B}`)).data;
  ok(Array.isArray(asB) && asB.length === 2 && !('answer' in asB[0]), 'registered employee sees who is going (no answers)');
  const asHost = (await call('GET', `/training/events/${id}/attendees?viewerId=${HOST}`)).data;
  ok(asHost.length === 3 && asHost.some((r: any) => r.answer === 'Sludge bulking'), 'host sees everyone with answers');

  // --- Cancel → promotion ---
  const cA = await call('POST', `/training/events/${id}/rsvp/cancel`, { employeeId: A });
  ok(cA.data?.myRsvp?.status === undefined || cA.data?.myRsvp === undefined, 'A cancels');
  const cState = (await call('GET', `/training/events/${id}?viewerId=${C}`)).data;
  ok(cState.myRsvp?.status === 'going', 'C promoted from the waitlist');
  ok(Boolean(await latest(C, 'event_waitlist_promoted')), 'C notified of promotion');
  ok(Boolean(await latest(HOST, 'event_rsvp_cancelled')), 'host notified of the cancellation');

  // --- Discussion ---
  ok((await call('POST', `/training/events/${id}/posts`, { authorEmployeeId: OUTSIDER, text: 'hi', kind: 'question' })).status === 403, 'non-attendee cannot post');
  await call('POST', `/training/events/${id}/posts`, { authorEmployeeId: B, text: 'Should we bring jar test data?', kind: 'question' });
  ok(Boolean(await latest(HOST, 'event_post_question')), 'host notified of a question');
  ok((await call('POST', `/training/events/${id}/posts`, { authorEmployeeId: B, text: 'x', kind: 'announcement' })).status === 403, 'attendee cannot post announcements');
  await call('POST', `/training/events/${id}/posts`, { authorEmployeeId: HOST, text: 'Bring last week’s SVI readings.', kind: 'announcement' });
  ok(Boolean(await latest(C, 'event_announcement')), 'going attendees get the announcement');
  const posts = (await call('GET', `/training/events/${id}/posts`)).data;
  ok(posts[0]?.kind === 'announcement' && posts[0]?.pinned, 'announcement is pinned on top');

  // --- Host edits time → notify ---
  const later = new Date(start.getTime() + 2 * 3600_000);
  const edited = await call('PATCH', `/training/events/${id}`, { actorId: HOST, startsAt: later.toISOString(), endsAt: new Date(later.getTime() + 3600_000).toISOString() });
  ok(edited.status === 200, 'host changes the time');
  ok(Boolean(await latest(B, 'event_changed')), 'attendees notified of the change');
  ok((await call('PATCH', `/training/events/${id}`, { actorId: B, title: 'hack' })).status === 403, 'non-host cannot edit');

  // --- Calendar & CSV ---
  const ics = await call('GET', `/training/events/${id}/calendar.ics`);
  ok(typeof ics.data === 'string' && ics.data.includes('BEGIN:VEVENT'), 'add-to-calendar .ics');
  const csv = await call('GET', `/training/events/${id}/attendees.csv?actorId=${HOST}`);
  ok(typeof csv.data === 'string' && csv.data.startsWith('Name,'), 'attendee CSV for host');

  // --- Lists ---
  const going = (await call('GET', `/training/events?view=going&viewerId=${B}`)).data;
  ok(going.some((e: any) => e.id === id), "B's Going tab lists the event");
  const hosting = (await call('GET', `/training/events?view=hosting&viewerId=${HOST}`)).data;
  ok(hosting.some((e: any) => e.id === id), "host's Hosting tab lists the event");

  // --- Cancel event ---
  const cancelled = await call('POST', `/training/events/${id}/cancel`, { actorId: HOST, reason: 'Plant shutdown' });
  ok(cancelled.data?.status === 'cancelled', 'host cancels with a reason');
  ok(Boolean(await latest(B, 'event_cancelled')), 'attendees notified of the cancellation');

  // --- Communities ---
  const comms = (await call('GET', `/training/communities?viewerId=${A}`)).data;
  ok(comms.length === 5 && comms.find((c: any) => c.slug === 'etp-operators-circle')?.isMember, '5 communities; A auto-joined ETP circle');
  const left = (await call('POST', '/training/communities/safety-circle/leave', { employeeId: A })).data;
  ok(left.isMember === false, 'A can leave an auto-joined community');
  const rejoined = (await call('POST', '/training/communities/safety-circle/join', { employeeId: A })).data;
  ok(rejoined.isMember === true, 'and join again');

  // --- Weak-area flags ---
  const notMgr = await call('POST', '/training/assignments', { employeeIds: [A], assignedByEmployeeId: 'emp0131', kind: 'suggested', topic: 'Polymer dosing', reason: 'x' });
  ok(notMgr.status === 403, "another plant's manager cannot flag A");
  const flag = await call('POST', '/training/assignments', { employeeIds: [A], assignedByEmployeeId: HOST, kind: 'suggested', topic: 'Polymer dosing', reason: 'Overdosing seen in last 3 shifts' });
  ok(flag.status === 201 && flag.data[0]?.kind === 'suggested', "A's allotted manager flags a weak topic");
  ok(Boolean(await latest(A, 'training_flagged')), 'A notified of the flag');
  const dir = await call('POST', '/training/assignments', { employeeIds: ['emp0134'], assignedByEmployeeId: DIRECTOR, kind: 'mandatory', courseId: 'course-etp-101', dueDate: '2026-11-30', reason: 'Cross-training' });
  ok(dir.status === 201, 'Director can assign anyone (mandatory needs course + due date)');
  const noDue = await call('POST', '/training/assignments', { employeeIds: [A], assignedByEmployeeId: HOST, kind: 'mandatory', courseId: 'course-etp-101', reason: 'x' });
  ok(noDue.status === 400, 'mandatory without a due date is rejected');
  const resolved = await call('POST', `/training/assignments/${flag.data[0].id}/resolve`, { actorId: A });
  ok(resolved.data?.status === 'resolved', 'flag resolved');
  ok(Boolean(await latest(HOST, 'training_flag_resolved')), 'manager notified that it is resolved');

  // --- Notifications read ---
  const before = (await notes(HOST)).filter((n) => !n.read).length;
  await call('PATCH', '/notifications/read-all', { employeeId: HOST });
  const after = (await notes(HOST)).filter((n) => !n.read).length;
  ok(before > 0 && after === 0, 'mark all read');

  // --- Training hours (stage, not certificate) ---
  const hours = (await call('GET', `/training/events-hours/emp0127`)).data;
  ok(typeof hours.hours === 'number', `training hours endpoint (${hours.hours}h from ${hours.eventsAttended} events)`);

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
