"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { App, Button, Progress, Result, Skeleton } from "antd";
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  DownOutlined,
  FileDoneOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  StarFilled,
  TrophyOutlined,
} from "@ant-design/icons";
import { getEvents, getTrainingAssignments } from "@/lib/api/training";
import {
  enrollInCourse,
  getAllCourses,
  getCertificates,
  getCourseById,
  getEnrollmentsForEmployee,
  hasGateQuestions,
  useTrainingData,
} from "@/lib/training/store";
import { useAsync, useViewer } from "@/lib/training/hooks";
import { toCard } from "@/lib/training/cards";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import CourseCard from "@/components/training/ui/CourseCard";
import Cover from "@/components/training/ui/Cover";
import { EventImageCard } from "@/components/training/ui/EventCard";
import { CARD_GRID } from "@/components/training/ui/Shelf";
import { tr, trTable, trNode, trData } from "@/lib/i18n";

const GATES = trTable([
  { key: "skillMap", title: "Skill mapping test", who: "Online, once every ability is done", weight: 25 },
  { key: "written", title: "Written test", who: "Online", weight: 25 },
  { key: "practical", title: "Practical on site", who: "Scored 1–5 per ability by your manager", weight: 30 },
  { key: "oral", title: "Oral viva", who: "Scored 1–5 per ability by your manager", weight: 20 },
] as const);

const SECTION_TITLE = "m-0 text-xl font-bold text-slate-900";

/** Course landing page: hero, what you'll learn, syllabus, how certification works, related events and courses; enrol card on the right. */
export default function CoursePage() {
  const { message } = App.useApp();
  const params = useParams();
  const router = useRouter();
  const courseId = String(Array.isArray(params?.courseId) ? params.courseId[0] : params?.courseId ?? "");
  const viewer = useViewer();
  const { ready, error, reload, version } = useTrainingData();
  const [busy, setBusy] = useState(false);
  const [openAbility, setOpenAbility] = useState<string | null>(null);
  const course = getCourseById(courseId);
  const me = viewer.personId ?? "";
  const enrollment = getEnrollmentsForEmployee(me).find((e) => e.courseId === course?.id);
  const cert = getCertificates(me).find((c) => c.courseId === course?.id);

  const assignment = useAsync(
    () => (me && course ? getTrainingAssignments({ employeeId: me, status: "open" }) : Promise.resolve([])),
    [me, course?.id],
  );
  const myAssignment = assignment.data?.find((a) => a.courseId === course?.id && a.kind !== "suggested");
  const events = useAsync(() => getEvents({ viewerId: me, view: "upcoming" }), [me]);
  const relatedEvents = (events.data ?? []).filter(
    (e) => e.status === "published" && e.topics.some((t) => (course?.skills ?? []).map((s) => s.toLowerCase()).includes(t.toLowerCase())),
  );

  const related = useMemo(() => {
    void version;
    if (!course) return [];
    return getAllCourses()
      .filter((c) => c.id !== course.id && c.section === course.section)
      .slice(0, 3);
  }, [course, version]);

  if (!ready && !error) return <Skeleton active style={{ padding: 24 }} />;
  if (error && !course) return <Result status="warning" title={tr("Couldn't load the course")} subTitle={trData(error)} extra={<Button onClick={reload}>{tr("Try again")}</Button>} />;
  if (!course) return <Result status="404" title={tr("Course not found")} extra={<Link href="/training/explore">{tr("Browse courses")}</Link>} />;

  const abilities = [...course.abilities].sort((a, b) => a.order - b.order);
  const doneOf = (id: string) => Boolean(enrollment?.abilityProgress[id]?.completedAt);
  const done = abilities.filter((a) => doneOf(a.id)).length;
  const pct = abilities.length ? Math.round((done / abilities.length) * 100) : 0;
  const videoMinutes = abilities.reduce((s, a) => s + (a.videoDurationMinutes ?? 0), 0);
  const quizzes = abilities.filter((a) => a.microQuiz?.questions?.length).length;
  const validity = course.certificateValidityMonths ?? 12;
  const prereqs = (course.prerequisites ?? []).map((id) => getCourseById(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));

  const start = async () => {
    if (!me) return;
    if (enrollment) {
      router.push(`/training/learn/${course.id}`);
      return;
    }
    setBusy(true);
    try {
      await enrollInCourse(me, course.id);
      router.push(`/training/learn/${course.id}`);
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cta = cert ? tr("Review course") : enrollment ? (enrollment.status === "IN_PROGRESS" ? tr("Resume learning") : tr("Continue to assessments")) : tr("Enroll for free");

  const includes: [React.ReactNode, string][] = [
    [<PlayCircleOutlined key="v" />, abilities.length === 1 ? tr("1 ability · {videoMinutes} min of video", { videoMinutes }) : tr("{count} abilities · {videoMinutes} min of video", { count: abilities.length, videoMinutes })],
    ...(quizzes ? ([[<FileDoneOutlined key="q" />, quizzes === 1 ? tr("1 micro-quiz") : tr("{quizzes} micro-quizzes", { quizzes })]] as [React.ReactNode, string][]) : []),
    [<ClockCircleOutlined key="h" />, tr("About {estimatedHours} h in total", { estimatedHours: course.estimatedHours })],
    [<SafetyCertificateOutlined key="a" />, tr("4-step assessment, practical on site")],
    [<TrophyOutlined key="c" />, tr("Certificate valid {validity} months", { validity: validity })],
  ];

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <TrainingSubNav />

      {/* Hero */}
      <header className="rounded-3xl bg-gradient-to-br from-[#1C4463] to-[#0B1A24] text-white p-6 sm:p-8">
        <nav aria-label={tr("Breadcrumbs")} className="text-xs font-medium text-white/60 flex gap-2 flex-wrap">
          <Link href="/training/explore" className="text-white/80! hover:text-white!">{tr("Explore")}</Link>
          <span>/</span>
          <Link href={`/training/explore?section=${encodeURIComponent(course.section)}`} className="text-white/80! hover:text-white!">{trData(course.section)}</Link>
        </nav>
        <div className="flex gap-2 flex-wrap mt-4">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 text-white">{course.code}</span>
          {course.level && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 text-white">{trData(course.level)}</span>}
          {myAssignment && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400 text-slate-900">
              {tr("Assigned by")}{" "}{trData(myAssignment.assignedByName)}
              {myAssignment.dueDate ? tr(" · due {dueDate}", { dueDate: myAssignment.dueDate.slice(0, 10) }) : ""}
            </span>
          )}
          {cert && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-400 text-slate-900">{tr("Certified ✓")}</span>}
        </div>
        <h1 className="m-0 mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">{trData(course.title)}</h1>
        <p className="m-0 mt-3 text-white/80 leading-relaxed max-w-3xl">{trData(course.description)}</p>
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-5 text-sm text-white/80">
          {typeof course.rating === "number" && (
            <span className="font-semibold text-white">
              <StarFilled className="text-amber-400" /> {course.rating.toFixed(1)}
              {course.reviewCount ? <span className="font-normal text-white/60"> {tr("({reviewCount} ratings)", { reviewCount: course.reviewCount })}</span> : null}
            </span>
          )}
          <span><ClockCircleOutlined /> {course.estimatedHours} h</span>
          <span><PlayCircleOutlined /> {abilities.length === 1 ? tr("{count} ability", { count: abilities.length }) : tr("{count} abilities", { count: abilities.length })}</span>
          <span><TrophyOutlined /> {tr("Certificate · {months} months", { months: validity })}</span>
        </div>
        {course.provider && <div className="mt-3 text-sm text-white/60">{trNode("Offered by {provider}", { provider: <span className="text-white/90 font-medium">{trData(course.provider)}</span> })}</div>}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <main className="flex flex-col gap-10 min-w-0 order-2 lg:order-1">
          {myAssignment?.reason && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <div className="text-sm font-semibold text-amber-900">{tr("Why {assignedByName} assigned this", { assignedByName: trData(myAssignment.assignedByName) })}</div>
              <p className="m-0 mt-1 text-sm text-amber-900/80">{trData(myAssignment.reason)}</p>
            </div>
          )}

          {course.skills?.length ? (
            <section aria-label={tr("Skills you'll gain")} className="flex flex-col gap-3">
              <h2 className={SECTION_TITLE}>{tr("Skills you'll gain")}</h2>
              <div className="flex gap-2 flex-wrap">
                {course.skills.map((s) => (
                  <Link
                    key={s}
                    href={`/training/explore?skill=${encodeURIComponent(s)}`}
                    className="px-3.5 py-1.5 rounded-full text-sm bg-white! border border-slate-200 text-slate-700! hover:border-[#1C4463] hover:text-[#1C4463]!"
                  >
                    {trData(s)}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {prereqs.length > 0 && (
            <section aria-label={tr("Before you start")} className="flex flex-col gap-2">
              <h2 className={SECTION_TITLE}>{tr("Before you start")}</h2>
              <p className="m-0 text-sm text-slate-500">
                {trNode("Finish {courses} first.", {
                  courses: prereqs.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ", "}
                      <Link href={`/training/course/${p.id}`} className="font-semibold text-emerald-700!">{p.code} {trData(p.title)}</Link>
                    </span>
                  )),
                })}
              </p>
            </section>
          )}

          {/* Syllabus */}
          <section aria-label={tr("Syllabus")} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className={SECTION_TITLE}>{tr("Syllabus")}</h2>
              <span className="text-sm text-slate-500">
                {abilities.length === 1 ? tr("{count} ability", { count: abilities.length }) : tr("{count} abilities", { count: abilities.length })} · {tr("{minutes} min", { minutes: videoMinutes })}
                {enrollment ? tr(" · {done} done", { done }) : ""}
              </span>
            </div>
            <ol className="m-0 p-0 list-none bg-white border border-slate-200 rounded-3xl divide-y divide-slate-100 overflow-hidden">
              {abilities.map((a) => {
                const isDone = doneOf(a.id);
                const open = openAbility === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenAbility(open ? null : a.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left bg-transparent cursor-pointer hover:bg-slate-50"
                    >
                      <span
                        className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                          isDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isDone ? <CheckCircleFilled /> : a.order}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900">{trData(a.title)}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {tr("{minutes} min video", { minutes: a.videoDurationMinutes })}{a.microQuiz?.questions?.length ? tr(" · micro-quiz") : ""}
                          {isDone ? tr(" · completed") : ""}
                        </span>
                      </span>
                      <DownOutlined className={`text-xs text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && <p className="m-0 px-5 pb-4 pl-[4.5rem] text-sm text-slate-600 leading-relaxed">{trData(a.description)}</p>}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Certification steps */}
          <section aria-label={tr("How you get certified")} className="flex flex-col gap-3">
            <div>
              <h2 className={SECTION_TITLE}>{tr("How you get certified")}</h2>
              <p className="m-0 mt-1 text-sm text-slate-500">
                {tr("Finish every ability, then pass these 4 steps. The certificate is issued automatically when all 4 pass (pass mark {passThreshold}%).", { passThreshold: course.passThreshold })}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {GATES.map((g, i) => {
                const missing = (g.key === "skillMap" || g.key === "written") && !hasGateQuestions(course, g.key);
                const result = enrollment?.assessments?.[g.key];
                const score = result ? ("scorePct" in result ? result.scorePct : result.overallPct) : undefined;
                return (
                  <div key={g.key} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-3">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-[#1C4463] text-white font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{trData(g.title)}</span>
                        <span className="text-xs font-semibold text-slate-500">{g.weight}%</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{trData(g.who)}</div>
                      <div className="mt-2 text-xs font-semibold">
                        {typeof score === "number" ? (
                          <span className="text-emerald-700">{tr("Scored {score}%", { score })}</span>
                        ) : missing ? (
                          <span className="text-slate-400">{tr("Questions not set up yet")}</span>
                        ) : (
                          <span className="text-slate-400">{tr("Not taken")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {relatedEvents.length > 0 && (
            <section aria-label={tr("Live sessions on this topic")} className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className={SECTION_TITLE}>{tr("Live sessions on this topic")}</h2>
                <Link href="/training/events" className="text-sm font-semibold text-emerald-700!">{tr("See all events")}</Link>
              </div>
              <div className={CARD_GRID}>
                {relatedEvents.slice(0, 3).map((e) => <EventImageCard key={e.id} event={e} />)}
              </div>
            </section>
          )}

          {related.length > 0 && (
            <section aria-label={tr("More in this domain")} className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className={SECTION_TITLE}>{tr("More in {section}", { section: trData(course.section) })}</h2>
                <Link href={`/training/explore?section=${encodeURIComponent(course.section)}`} className="text-sm font-semibold text-emerald-700!">{tr("See all")}</Link>
              </div>
              <div className={CARD_GRID}>
                {related.map((c) => <CourseCard key={c.id} course={toCard(c)} />)}
              </div>
            </section>
          )}
        </main>

        {/* Enrol card — its own column, sticky on desktop */}
        <aside aria-label={tr("Enrollment")} className="order-1 lg:order-2 lg:sticky lg:top-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="aspect-[16/9] bg-slate-100">
              <Cover src={course.thumbnailUrl} label={trData(course.title)} />
            </div>
            <div className="p-5 flex flex-col gap-4">
              {cert ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <div className="font-semibold text-emerald-800"><CheckCircleFilled />{" "}{tr("You're certified")}</div>
                  <div className="text-xs text-emerald-800/80 mt-0.5">{tr("Valid until {date}", { date: cert.expiresAt?.slice(0, 10) ?? "—" })}</div>
                </div>
              ) : enrollment ? (
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-900">{tr("{done} of {abilitieCount} abilities done", { done, abilitieCount: abilities.length })}</span>
                    <span className="text-slate-500">{pct}%</span>
                  </div>
                  <Progress percent={pct} showInfo={false} strokeColor="#1C4463" railColor="#e2e8f0" className="m-0!" />
                </div>
              ) : null}

              <Button type="primary" size="large" block loading={busy} onClick={start} disabled={!me} className="h-12! rounded-xl! font-semibold!">
                {trData(cta)}
              </Button>
              {cert && (
                <Link href="/certifications?mine=1" className="text-center text-sm font-semibold text-emerald-700!">
                  {tr("View certificate")}
                </Link>
              )}

              <div className="border-t border-slate-100 pt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{tr("This course includes")}</div>
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {includes.map(([icon, text]) => (
                    <li key={text} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <span className="text-[#1C4463]">{icon}</span>
                      {trData(text)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
