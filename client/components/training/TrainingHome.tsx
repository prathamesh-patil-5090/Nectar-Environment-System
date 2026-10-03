"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Alert, Button, Progress, Result, Skeleton } from "antd";
import { getTrainingFeed } from "@/lib/api/training";
import { useAsync, useViewer } from "@/lib/training/hooks";
import { useTrainingData } from "@/lib/training/store";
import type { CourseCardData, EnrollmentSummary, TrainingFeed } from "@/lib/training/types";
import Shelf from "./ui/Shelf";
import CourseCard from "./ui/CourseCard";
import SuggestionCard from "./ui/SuggestionCard";
import TrainingSubNav from "./ui/TrainingSubNav";
import TrainingSidebar from "./ui/TrainingSidebar";
import Cover from "./ui/Cover";
import { CARD_GRID } from "./ui/Shelf";

const ROLE_PATH_ROLES = new Set(["employee", "shift_incharge", "supervisor", "safety_incharge", "site_incharge"]);

/** Big "pick up where you left off" card in the hero. */
function ResumeCard({ course, enrollment, label }: { course: CourseCardData; enrollment?: EnrollmentSummary; label: string }) {
  return (
    <Link
      href={`/training/course/${course.id}`}
      className="group flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center bg-white/10! hover:bg-white/15! border border-white/15 rounded-2xl p-3 transition-colors min-w-0"
    >
      <div className="w-full sm:w-36 aspect-[16/9] rounded-xl overflow-hidden shrink-0 bg-white/10">
        <Cover src={course.thumbnailUrl} label={course.title} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">{label}</div>
        <div className="font-bold text-white leading-snug line-clamp-2 group-hover:underline">{course.title}</div>
        {enrollment && (
          <div className="flex items-center gap-2 mt-1">
            <Progress percent={enrollment.pct} size="small" showInfo={false} strokeColor="#34d399" railColor="rgba(255,255,255,0.2)" className="m-0! flex-1" />
            <span className="text-xs text-white/80 shrink-0">{enrollment.done}/{enrollment.total}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

const SAFETY_BADGE = {
  certified: { text: "Certified", color: "green" },
  in_progress: { text: "In progress", color: "blue" },
} as const;

/** Safety training: every safety course, compulsory for employees, site managers, shift in-charges, managers and safety in-charges. */
function SafetySection({ safety }: { safety: TrainingFeed["safety"] }) {
  const total = safety.courses.length;
  const pct = total ? Math.round((safety.done / total) * 100) : 0;
  const allDone = total > 0 && safety.done === total;
  return (
    <section id="safety-training" aria-label="Safety training" className="scroll-mt-4 rounded-3xl border-2 border-[#1C4463]/20 bg-white p-5 sm:p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="m-0 text-xl font-bold text-slate-900">Safety training</h2>
            {safety.compulsory ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1C4463] text-white">Compulsory</span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Recommended</span>
            )}
          </div>
          <p className="m-0 mt-1 text-sm text-slate-500">
            {safety.compulsory
              ? "Every plant employee must complete these and keep the certificates valid."
              : "Safety courses everyone at the plants completes."}
          </p>
        </div>
        {total > 0 && (
          <div className="w-full sm:w-64">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold text-slate-900">{safety.done} of {total} certified</span>
              <span className={allDone ? "font-semibold text-emerald-700" : "text-slate-500"}>{allDone ? "All done ✓" : `${pct}%`}</span>
            </div>
            <Progress percent={pct} showInfo={false} strokeColor={allDone ? "#047857" : "#1C4463"} railColor="#e2e8f0" className="m-0!" />
          </div>
        )}
      </div>
      {total === 0 ? (
        <p className="m-0 text-sm text-slate-500">No safety courses in the catalog yet.</p>
      ) : (
        <div className={CARD_GRID}>
          {safety.courses.map((s) => (
            <CourseCard
              key={s.course.id}
              course={s.course}
              badge={
                s.status === "not_started"
                  ? safety.compulsory ? { text: "Required", color: "volcano" } : { text: "Not started", color: "default" }
                  : SAFETY_BADGE[s.status]
              }
              reason={s.status === "certified" && s.certExpiresAt ? `Certificate valid until ${s.certExpiresAt.slice(0, 10)}` : undefined}
              progressPct={s.status === "in_progress" ? s.enrollment?.pct : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Personal Training Home: hero with stats and resume, course shelves, and an events / mentors / communities sidebar. */
export default function TrainingHome() {
  const viewer = useViewer();
  useTrainingData(); // site names for in-plant events
  const { data: feed, error, loading, reload } = useAsync(
    () => (viewer.personId ? getTrainingFeed(viewer.personId) : Promise.reject(new Error("No profile on this login"))),
    [viewer.personId],
  );

  // Each course appears once: the first shelf that has it keeps it (required paths always stay whole)
  const shelves = useMemo(() => {
    if (!feed) return undefined;
    // The hero shows one course (in progress, else the next assigned); the shelves skip it
    const resume = feed.continueLearning[0];
    const nextAssigned = resume ? undefined : feed.assigned[0];
    const heroId = resume?.course.id ?? nextAssigned?.course.id;
    // Safety training is a checklist and always shows in full; later shelves skip its courses
    const seen = new Set<string>([...(heroId ? [heroId] : []), ...feed.safety.courses.map((c) => c.course.id)]);
    const fresh = <T,>(list: T[], id: (x: T) => string) =>
      list.filter((x) => {
        if (seen.has(id(x))) return false;
        seen.add(id(x));
        return true;
      });
    const assigned = fresh(feed.assigned, (a) => a.course.id);
    const continueLearning = fresh(feed.continueLearning, (c) => c.course.id);
    feed.requiredPaths.forEach((p) => p.steps.forEach((s) => seen.add(s.courseId)));
    const recommended = fresh(feed.recommended, (r) => r.course.id);
    const popular = fresh(feed.popularAtSite, (p) => p.course.id);
    return { resume, nextAssigned, assigned, continueLearning, recommended, popular };
  }, [feed]);

  if (!viewer.personId) {
    return <Result status="info" title="Training needs a profile on your login" />;
  }

  const first = feed?.me.name.split(" ")[0];
  const stats: [string, number | undefined, string][] = [
    ["Assigned", feed?.stats.assigned, "/training/my-learning?tab=assigned"],
    ["In progress", feed?.stats.inProgress, "/training/my-learning?tab=progress"],
    ["Certified", feed?.stats.certified, "/certifications?mine=1"],
  ];
  const nextAssigned = shelves?.nextAssigned;

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <TrainingSubNav />

      {/* Hero */}
      <header className="rounded-3xl bg-gradient-to-br from-[#1C4463] to-[#0B1A24] text-white p-6 sm:p-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] items-center">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {first ? `Welcome back, ${first}` : "Your training"}
          </h1>
          <p className="m-0 mt-1 text-white/70">
            {feed?.me.designation}
            {feed?.me.siteName ? ` · ${feed.me.siteName}` : ""}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-5 sm:flex sm:gap-3">
            {stats.map(([label, value, href]) => (
              <Link key={label} href={href} className="min-w-0 sm:min-w-[110px] rounded-2xl bg-white/10! hover:bg-white/15! border border-white/15 px-4 py-2.5 transition-colors">
                <div className="text-2xl font-extrabold text-white">{loading ? "–" : value ?? 0}</div>
                <div className="text-xs text-white/70">{label}</div>
              </Link>
            ))}
          </div>
        </div>
        {loading && !feed ? (
          <Skeleton.Node active style={{ width: "100%", height: 100, borderRadius: 16 }} />
        ) : shelves?.resume ? (
          <ResumeCard course={shelves.resume.course} enrollment={shelves.resume.enrollment} label="Pick up where you left off" />
        ) : nextAssigned ? (
          <ResumeCard course={nextAssigned.course} enrollment={nextAssigned.enrollment} label="Start your assigned course" />
        ) : (
          <Link href="/training/explore" className="rounded-2xl bg-white/10! hover:bg-white/15! border border-white/15 p-5 text-white! font-semibold">
            Nothing in progress. Explore the catalog →
          </Link>
        )}
      </header>

      {error && (
        <Alert type="error" showIcon title="Couldn't load your training" description={error} action={<Button onClick={reload}>Try again</Button>} />
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <main className="flex flex-col gap-10 min-w-0">
          {feed && <SafetySection safety={feed.safety} />}

          <Shelf
            title="Assigned to you"
            subtitle="Mandatory training from your manager, earliest due first."
            items={shelves?.assigned}
            loading={loading}
            emptyText="Nothing assigned right now 🎉"
            hideWhenEmpty={Boolean(nextAssigned)}
            viewAllHref="/training/my-learning?tab=assigned"
            render={(a) => (
              <CourseCard
                key={a.assignment.id}
                course={a.course}
                badge={
                  a.overdue
                    ? { text: "Overdue", color: "red" }
                    : { text: a.assignment.dueDate ? `Due ${a.assignment.dueDate.slice(0, 10)}` : "Assigned", color: "gold" }
                }
                reason={`${a.assignment.assignedByName}: ${a.assignment.reason}`}
                progressPct={a.enrollment?.pct}
              />
            )}
          />

          <Shelf
            title="Your manager suggests"
            subtitle="Weak areas your manager wants you to work on."
            items={feed?.suggestions}
            loading={loading}
            hideWhenEmpty
            viewAllHref="/training/my-learning?tab=flags"
            render={(s) => <SuggestionCard key={s.assignment.id} assignment={s.assignment} course={s.course} matches={s.matches} />}
          />

          <Shelf
            title="Continue learning"
            items={shelves?.continueLearning}
            loading={loading}
            hideWhenEmpty
            viewAllHref="/training/my-learning?tab=progress"
            render={(c) => (
              <CourseCard
                key={c.enrollment.id}
                course={c.course}
                badge={c.enrollment.status === "IN_PROGRESS" ? undefined : { text: "Assessment stage", color: "blue" }}
                progressPct={c.enrollment.pct}
              />
            )}
          />

          {feed?.requiredPaths.map((p) => {
            const done = p.steps.filter((s) => s.certified).length;
            return (
              <Shelf
                key={p.id}
                title={p.title}
                subtitle={`Required for your role · ${done} of ${p.steps.length} done`}
                items={p.steps}
                render={(s) => (
                  <CourseCard
                    key={s.courseId}
                    course={s.course}
                    badge={s.certified ? { text: "Certified", color: "green" } : s.mandatory ? { text: "Required", color: "volcano" } : undefined}
                  />
                )}
              />
            );
          })}
          {!loading && feed && feed.requiredPaths.length === 0 && ROLE_PATH_ROLES.has(viewer.role) && (
            <Alert type="info" showIcon title="Your role's required learning path hasn't been set up yet." />
          )}

          <Shelf
            title="Recommended for you"
            subtitle="Based on your manager's suggestions, your role, your plant and your results."
            items={shelves?.recommended}
            loading={loading}
            emptyText="No recommendations yet. Browse the catalog to find a course."
            viewAllHref="/training/explore"
            render={(r) => (
              <CourseCard
                key={r.course.id}
                course={r.course}
                reason={r.reason}
                badge={r.suggestedBy ? { text: "Suggested", color: "purple" } : undefined}
              />
            )}
          />

          <Shelf
            title={`Popular at ${feed?.me.siteName ?? "your site"}`}
            subtitle="What colleagues in the same role are learning."
            items={shelves?.popular}
            loading={loading}
            hideWhenEmpty
            render={(p) => (
              <CourseCard
                key={p.course.id}
                course={p.course}
                reason={`${p.learners} ${p.learners === 1 ? "colleague" : "colleagues"} enrolled`}
              />
            )}
          />
        </main>

        <TrainingSidebar personId={viewer.personId} events={feed?.upcomingEvents} eventsLoading={loading} />
      </div>
    </div>
  );
}
