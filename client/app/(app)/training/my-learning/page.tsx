"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Empty, Tabs } from "antd";
import { getTrainingAssignments } from "@/lib/api/training";
import { getCertificates, getCourseById, getEnrollmentsForEmployee, useTrainingData } from "@/lib/training/store";
import { useAsync, useViewer } from "@/lib/training/hooks";
import type { Course, CourseEnrollment } from "@/lib/training/types";
import { toCard } from "@/lib/training/cards";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import CourseCard from "@/components/training/ui/CourseCard";
import TrainingScheduleView from "@/components/training/TrainingScheduleView";
import styles from "@/components/training/ui/training.module.css";

const pctOf = (e: CourseEnrollment, c: Course) =>
  c.abilities.length ? Math.round((c.abilities.filter((a) => e.abilityProgress[a.id]?.completedAt).length / c.abilities.length) * 100) : 0;

/** My Learning: In progress · Assigned · Completed · Assessment schedule. */
export default function MyLearningPage() {
  const viewer = useViewer();
  const me = viewer.personId ?? "";
  const { version } = useTrainingData();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params?.get("tab") ?? "progress";
  const assignments = useAsync(() => (me ? getTrainingAssignments({ employeeId: me, status: "open" }) : Promise.resolve([])), [me]);

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

  const grid = (nodes: React.ReactNode[], empty: string) =>
    nodes.length ? <div className={styles.grid}>{nodes}</div> : <div className={styles.panel}><Empty description={empty} /></div>;

  return (
    <div className={styles.page}>
      <TrainingSubNav />
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0B1A24" }}>My Learning</h1>
      <Tabs
        activeKey={tab}
        onChange={(k) => router.replace(`${pathname}?tab=${k}`, { scroll: false })}
        items={[
          {
            key: "progress",
            label: `In progress (${inProgress.length})`,
            children: grid(
              inProgress.map(({ e, c }) => (
                <CourseCard
                  key={e.id}
                  course={toCard(c)}
                  progressPct={pctOf(e, c)}
                  badge={e.status === "IN_PROGRESS" ? undefined : { text: "Assessment stage", color: "blue" }}
                />
              )),
              "You haven't started a course yet",
            ),
          },
          {
            key: "assigned",
            label: `Assigned (${(assignments.data ?? []).filter((a) => a.kind !== "suggested").length})`,
            children: grid(
              (assignments.data ?? [])
                .filter((a) => a.kind !== "suggested" && a.courseId && getCourseById(a.courseId))
                .map((a) => {
                  const c = getCourseById(a.courseId!)!;
                  const overdue = a.dueDate && a.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
                  return (
                    <CourseCard
                      key={a.id}
                      course={toCard(c)}
                      reason={`${a.assignedByName}: ${a.reason}`}
                      badge={overdue ? { text: "Overdue", color: "red" } : { text: a.dueDate ? `Due ${a.dueDate.slice(0, 10)}` : "Assigned", color: "gold" }}
                    />
                  );
                }),
              "Nothing assigned",
            ),
          },
          {
            key: "flags",
            label: `Suggested by manager (${(assignments.data ?? []).filter((a) => a.kind === "suggested").length})`,
            children: (assignments.data ?? []).filter((a) => a.kind === "suggested").length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(assignments.data ?? [])
                  .filter((a) => a.kind === "suggested")
                  .map((a) => (
                    <div key={a.id} className={styles.panel}>
                      <strong>{a.topic || a.skills?.join(", ") || getCourseById(a.courseId ?? "")?.title}</strong>
                      <div className={styles.line}>{a.assignedByName}: {a.reason}</div>
                      <div style={{ marginTop: 6 }}>
                        <a href={a.courseId ? `/training/course/${a.courseId}` : `/training/explore?q=${encodeURIComponent(a.topic ?? a.skills?.[0] ?? "")}`}>
                          Find training →
                        </a>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className={styles.panel}><Empty description="No weak areas flagged" /></div>
            ),
          },
          {
            key: "completed",
            label: `Completed (${completed.length})`,
            children: grid(
              completed.map(({ e, c }) => {
                const cert = certs.find((x) => x.courseId === c.id);
                return (
                  <CourseCard
                    key={e.id}
                    course={toCard(c)}
                    badge={{ text: "Certified", color: "green" }}
                    reason={cert?.expiresAt ? `Valid until ${cert.expiresAt.slice(0, 10)}` : undefined}
                  />
                );
              }),
              "No completed courses yet",
            ),
          },
          { key: "schedule", label: "Assessment schedule", children: <TrainingScheduleView employeeId={me} /> },
        ]}
      />
    </div>
  );
}
