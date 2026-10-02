"use client";

import Link from "next/link";
import { Alert, Button, Result, Tag } from "antd";
import { getTrainingFeed } from "@/lib/api/training";
import { useAsync, useViewer } from "@/lib/training/hooks";
import { useTrainingData } from "@/lib/training/store";
import Shelf from "./ui/Shelf";
import CourseCard from "./ui/CourseCard";
import EventCard from "./ui/EventCard";
import TrainingSubNav from "./ui/TrainingSubNav";
import styles from "./ui/training.module.css";

const ROLE_PATH_ROLES = new Set(["employee", "shift_incharge", "supervisor", "safety_incharge", "site_incharge"]);

/** Personal Training Home (Coursera-style): every shelf shows 4 cards, then "Show more". */
export default function TrainingHome() {
  const viewer = useViewer();
  useTrainingData(); // site names for in-plant events
  const { data: feed, error, loading, reload } = useAsync(
    () => (viewer.personId ? getTrainingFeed(viewer.personId) : Promise.reject(new Error("No profile on this login"))),
    [viewer.personId],
  );

  if (!viewer.personId) {
    return <Result status="info" title="Training needs a profile on your login" />;
  }

  const first = feed?.me.name.split(" ")[0];
  const stat = (label: string, value: number | undefined, href: string) => (
    <Link href={href} className={styles.panel} style={{ textDecoration: "none", minWidth: 130, padding: "10px 16px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#0B1A24" }}>{loading ? "–" : value ?? 0}</div>
      <div style={{ fontSize: 12.5, color: "#4A6375" }}>{label}</div>
    </Link>
  );

  return (
    <div className={styles.page}>
      <TrainingSubNav />

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0B1A24" }}>
            {first ? `Welcome back, ${first}` : "Your training"}
          </h1>
          <p style={{ margin: "4px 0 0", color: "#4A6375" }}>
            {feed?.me.designation}
            {feed?.me.siteName ? ` · ${feed.me.siteName}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {stat("Assigned", feed?.stats.assigned, "/training/my-learning?tab=assigned")}
          {stat("In progress", feed?.stats.inProgress, "/training/my-learning?tab=progress")}
          {stat("Certified", feed?.stats.certified, "/certifications?mine=1")}
        </div>
      </header>

      {error && (
        <Alert type="error" showIcon title="Couldn't load your training" description={error} action={<Button onClick={reload}>Try again</Button>} />
      )}

      <Shelf
        title="Assigned to you"
        subtitle="Mandatory training from your manager, earliest due first."
        items={feed?.assigned}
        loading={loading}
        emptyText="Nothing assigned right now 🎉"
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
        render={(s) => {
          const a = s.assignment;
          const what = a.topic || a.skills?.join(", ") || s.course?.title || "Training";
          const href = s.course
            ? `/training/course/${s.course.id}`
            : s.matches[0]
              ? `/training/course/${s.matches[0].id}`
              : `/training/explore?q=${encodeURIComponent(a.topic ?? a.skills?.[0] ?? "")}`;
          return (
            <Link key={a.id} href={href} className={styles.card}>
              <div className={styles.body}>
                <Tag color="purple" style={{ alignSelf: "flex-start", margin: 0 }}>Suggested by {a.assignedByName}</Tag>
                <h3 className={styles.title}>{what}</h3>
                <div className={styles.line} style={{ whiteSpace: "normal" }}>{a.reason}</div>
                <div className={styles.reason}>
                  {s.course ? `Course: ${s.course.title}` : s.matches.length ? `Try: ${s.matches.map((m) => m.code).join(", ")}` : "Find matching training →"}
                </div>
              </div>
            </Link>
          );
        }}
      />

      <Shelf
        title="Continue learning"
        items={feed?.continueLearning}
        loading={loading}
        hideWhenEmpty
        viewAllHref="/training/my-learning?tab=progress"
        render={(c) => (
          <CourseCard
            key={c.enrollment.id}
            course={c.course}
            badge={{ text: c.enrollment.status === "IN_PROGRESS" ? "In progress" : "Assessment stage", color: "blue" }}
            progressPct={c.enrollment.pct}
          />
        )}
      />

      <Shelf
        title="Recommended for you"
        subtitle="Based on your manager's suggestions, your role, your plant and your results."
        items={feed?.recommended}
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
        title="Upcoming events"
        subtitle="Live sessions and seminars by our mentors."
        items={feed?.upcomingEvents}
        loading={loading}
        emptyText="No upcoming events"
        viewAllHref="/training/events"
        render={(e) => <EventCard key={e.id} event={e} />}
      />

      <Shelf
        title={`Popular at ${feed?.me.siteName ?? "your site"}`}
        subtitle="What colleagues in the same role are learning."
        items={feed?.popularAtSite}
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

      <div style={{ textAlign: "center" }}>
        <Link href="/training/explore">
          <Tag color="#1C4463" style={{ padding: "6px 14px", fontSize: 13 }}>Browse all courses →</Tag>
        </Link>
      </div>
    </div>
  );
}
