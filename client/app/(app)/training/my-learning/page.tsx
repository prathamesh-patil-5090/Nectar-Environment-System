"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Empty, Skeleton } from "antd";
import { getEvents, getTrainingAssignments } from "@/lib/api/training";
import { getCertificates, getCourseById, getEnrollmentsForEmployee, useTrainingData } from "@/lib/training/store";
import { useAsync, useViewer } from "@/lib/training/hooks";
import type { Course, CourseEnrollment } from "@/lib/training/types";
import { toCard } from "@/lib/training/cards";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import CourseCard from "@/components/training/ui/CourseCard";
import SuggestionCard from "@/components/training/ui/SuggestionCard";
import { EventImageCard } from "@/components/training/ui/EventCard";
import { CARD_GRID } from "@/components/training/ui/Shelf";
import TrainingScheduleView from "@/components/training/TrainingScheduleView";
import { tr, trData } from "@/lib/i18n";

const pctOf = (e: CourseEnrollment, c: Course) =>
  c.abilities.length ? Math.round((c.abilities.filter((a) => e.abilityProgress[a.id]?.completedAt).length / c.abilities.length) * 100) : 0;

const today = () => new Date().toISOString().slice(0, 10);

/** My Learning: In progress · Assigned · Suggested · Completed · My events · Assessment schedule. */
export default function MyLearningPage() {
  const viewer = useViewer();
  const me = viewer.personId ?? "";
  const { version } = useTrainingData();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params?.get("tab") ?? "progress";
  const assignments = useAsync(() => (me ? getTrainingAssignments({ employeeId: me, status: "open" }) : Promise.resolve([])), [me]);
  const myEvents = useAsync(() => (me ? getEvents({ viewerId: me, view: "going" }) : Promise.resolve([])), [me]);

  const { inProgress, completed } = useMemo(() => {
    void version;
    const rows = getEnrollmentsForEmployee(me)
      .map((e) => ({ e, c: getCourseById(e.courseId) }))
      .filter((x): x is { e: CourseEnrollment; c: Course } => Boolean(x.c));
    return {
      inProgress: rows.filter((x) => x.e.status !== "CERTIFIED"),
      completed: rows.filter((x) => x.e.status === "CERTIFIED"),
    };
  }, [me, version]);
  const certs = getCertificates(me);

  const open = assignments.data ?? [];
  const assigned = open.filter((a) => a.kind !== "suggested" && a.courseId && getCourseById(a.courseId));
  const suggested = open.filter((a) => a.kind === "suggested");
  const events = myEvents.data ?? [];

  const tabs: { key: string; label: string; count?: number }[] = [
    { key: "progress", label: tr("In progress"), count: inProgress.length },
    { key: "assigned", label: tr("Assigned"), count: assigned.length },
    { key: "flags", label: tr("Suggested by manager"), count: suggested.length },
    { key: "completed", label: tr("Completed"), count: completed.length },
    { key: "events", label: tr("My events"), count: events.length },
    { key: "schedule", label: tr("Assessment schedule") },
  ];

  const grid = (nodes: ReactNode[], empty: string, loading?: boolean) =>
    loading ? (
      <Skeleton active />
    ) : nodes.length ? (
      <div className={CARD_GRID}>{nodes}</div>
    ) : (
      <div className="bg-white border border-slate-200 rounded-2xl py-8">
        <Empty description={trData(empty)} />
      </div>
    );

  let body: ReactNode;
  if (tab === "assigned") {
    body = grid(
      assigned.map((a) => {
        const c = getCourseById(a.courseId!)!;
        const overdue = a.dueDate && a.dueDate.slice(0, 10) < today();
        return (
          <CourseCard
            key={a.id}
            course={toCard(c)}
            reason={`${trData(a.assignedByName)}: ${trData(a.reason)}`}
            badge={overdue ? { text: tr("Overdue"), color: "red" } : { text: a.dueDate ? tr("Due {dueDate}", { dueDate: a.dueDate.slice(0, 10) }) : tr("Assigned"), color: "gold" }}
          />
        );
      }),
      tr("Nothing assigned"),
      assignments.loading,
    );
  } else if (tab === "flags") {
    body = grid(
      suggested.map((a) => {
        const c = a.courseId ? getCourseById(a.courseId) : undefined;
        return <SuggestionCard key={a.id} assignment={a} course={c ? toCard(c) : undefined} matches={[]} />;
      }),
      tr("No weak areas flagged"),
      assignments.loading,
    );
  } else if (tab === "completed") {
    body = grid(
      completed.map(({ e, c }) => {
        const cert = certs.find((x) => x.courseId === c.id);
        return (
          <CourseCard
            key={e.id}
            course={toCard(c)}
            badge={{ text: tr("Certified"), color: "green" }}
            reason={cert?.expiresAt ? tr("Valid until {expiresAt}", { expiresAt: cert.expiresAt.slice(0, 10) }) : undefined}
          />
        );
      }),
      tr("No completed courses yet"),
    );
  } else if (tab === "events") {
    body = grid(events.map((e) => <EventImageCard key={e.id} event={e} />), tr("You haven't registered for any events"), myEvents.loading);
  } else if (tab === "schedule") {
    body = (
      <div className="bg-white border border-slate-200 rounded-3xl p-5">
        <TrainingScheduleView employeeId={me} />
      </div>
    );
  } else {
    body = grid(
      inProgress.map(({ e, c }) => (
        <CourseCard
          key={e.id}
          course={toCard(c)}
          progressPct={pctOf(e, c)}
          badge={e.status === "IN_PROGRESS" ? undefined : { text: tr("Assessment stage"), color: "blue" }}
        />
      )),
      tr("You haven't started a course yet"),
    );
  }

  const certifiedCount = completed.length;
  const avgPct = inProgress.length ? Math.round(inProgress.reduce((s, { e, c }) => s + pctOf(e, c), 0) / inProgress.length) : 0;
  const overdueCount = assigned.filter((a) => a.dueDate && a.dueDate.slice(0, 10) < today()).length;
  const stats: [string, string | number][] = [
    [tr("In progress"), inProgress.length],
    [tr("Average progress"), `${avgPct}%`],
    [tr("Certified"), certifiedCount],
    [tr("Overdue"), overdueCount],
  ];

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <TrainingSubNav />

      <header className="rounded-3xl bg-gradient-to-br from-[#1C4463] to-[#0B1A24] p-6 sm:p-8 flex flex-col gap-5">
        <div>
          <h1 className="m-0 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{tr("My Learning")}</h1>
          <p className="m-0 mt-1 text-white/70">{tr("Your courses, assignments, certificates and registered events in one place.")}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2.5">
              <div className="text-2xl font-extrabold text-white">{value}</div>
              <div className="text-xs text-white/70">{trData(label)}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-200" role="tablist" aria-label={tr("My Learning")}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => router.replace(`${pathname}?tab=${t.key}`, { scroll: false })}
              className={`shrink-0 px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors cursor-pointer bg-transparent ${
                active ? "border-[#1C4463] text-[#1C4463]" : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {trData(t.label)}
              {typeof t.count === "number" && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] ${active ? "bg-[#1C4463] text-white" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <section role="tabpanel">{body}</section>
    </div>
  );
}
