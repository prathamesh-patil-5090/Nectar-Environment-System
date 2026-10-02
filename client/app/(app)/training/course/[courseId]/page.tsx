"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert, App, Button, Collapse, Empty, Progress, Result, Skeleton, Tabs, Tag } from "antd";
import { CheckCircleFilled, LockOutlined, StarFilled } from "@ant-design/icons";
import { getEvents, getTrainingAssignments } from "@/lib/api/training";
import {
  enrollInCourse,
  getCertificates,
  getCourseById,
  getEnrollmentsForEmployee,
  hasGateQuestions,
  useTrainingData,
} from "@/lib/training/store";
import { useAsync, useViewer } from "@/lib/training/hooks";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import EventCard from "@/components/training/ui/EventCard";
import styles from "@/components/training/ui/training.module.css";

const GATES = [
  { key: "skillMap", title: "1 · Skill mapping test", who: "Online, after every ability is done", weight: "25%" },
  { key: "written", title: "2 · Written test", who: "Online", weight: "25%" },
  { key: "practical", title: "3 · Practical on site", who: "Scored 1–5 per ability by your manager", weight: "30%" },
  { key: "oral", title: "4 · Oral viva", who: "Scored 1–5 per ability by your manager", weight: "20%" },
] as const;

/** Course landing page (Coursera-style): About · Syllabus · Assessment · Events, with Enroll / Resume. */
export default function CoursePage() {
  const { message } = App.useApp();
  const params = useParams();
  const router = useRouter();
  const courseId = String(Array.isArray(params?.courseId) ? params.courseId[0] : params?.courseId ?? "");
  const viewer = useViewer();
  const { ready, error, reload } = useTrainingData();
  const [busy, setBusy] = useState(false);
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

  if (!ready && !error) return <Skeleton active style={{ padding: 24 }} />;
  if (error && !course) return <Result status="warning" title="Couldn't load the course" subTitle={error} extra={<Button onClick={reload}>Try again</Button>} />;
  if (!course) return <Result status="404" title="Course not found" extra={<Link href="/training/explore">Browse courses</Link>} />;

  const done = enrollment ? course.abilities.filter((a) => enrollment.abilityProgress[a.id]?.completedAt).length : 0;
  const pct = course.abilities.length ? Math.round((done / course.abilities.length) * 100) : 0;

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

  const cta = cert ? "Review course" : enrollment ? (enrollment.status === "IN_PROGRESS" ? "Resume" : "Continue to assessments") : "Enroll";

  return (
    <div className={styles.page}>
      <TrainingSubNav />

      <div className={styles.twoCol}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className={styles.line}>
            <Link href="/training/explore">Explore</Link> / {course.section}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#0B1A24" }}>{course.title}</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", color: "#4A6375" }}>
            <Tag>{course.code}</Tag>
            {course.level && <span>{course.level}</span>}
            {course.estimatedHours ? <span>· {course.estimatedHours} h</span> : null}
            <span>· {course.abilities.length} abilities</span>
            {typeof course.rating === "number" && (
              <span>
                · <StarFilled style={{ color: "#D97706" }} /> {course.rating.toFixed(1)}
                {course.reviewCount ? ` (${course.reviewCount})` : ""}
              </span>
            )}
            <span>· Certificate valid {course.certificateValidityMonths ?? 12} months</span>
          </div>

          {myAssignment && (
            <Alert
              type="warning"
              showIcon
              title={`Assigned by ${myAssignment.assignedByName}${myAssignment.dueDate ? ` · due ${myAssignment.dueDate.slice(0, 10)}` : ""}`}
              description={myAssignment.reason}
            />
          )}

          <Tabs
            items={[
              {
                key: "about",
                label: "About",
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>{course.description}</p>
                    {course.skills?.length ? (
                      <div>
                        <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Skills you&apos;ll gain</h3>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {course.skills.map((s) => (
                            <Link key={s} href={`/training/explore?skill=${encodeURIComponent(s)}`}>
                              <Tag style={{ margin: 0 }}>{s}</Tag>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {course.provider && <div className={styles.line}>Offered by {course.provider}</div>}
                  </div>
                ),
              },
              {
                key: "syllabus",
                label: `Syllabus (${course.abilities.length})`,
                children: (
                  <Collapse
                    items={[...course.abilities]
                      .sort((a, b) => a.order - b.order)
                      .map((a) => {
                        const isDone = Boolean(enrollment?.abilityProgress[a.id]?.completedAt);
                        return {
                          key: a.id,
                          label: (
                            <span>
                              {isDone ? <CheckCircleFilled style={{ color: "#16A34A" }} /> : <LockOutlined style={{ color: "#94A3B8" }} />}{" "}
                              <strong>{a.order}. {a.title}</strong>
                              <span style={{ color: "#4A6375" }}> · {a.videoDurationMinutes} min{a.microQuiz?.questions?.length ? " · quiz" : ""}</span>
                            </span>
                          ),
                          children: <p style={{ margin: 0 }}>{a.description}</p>,
                        };
                      })}
                  />
                ),
              },
              {
                key: "assessment",
                label: "Assessment",
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ margin: 0 }}>
                      Finish every ability, then pass 4 gates. The certificate is issued automatically when all 4 pass (pass mark {course.passThreshold}%).
                    </p>
                    {GATES.map((g) => {
                      const missing = (g.key === "skillMap" || g.key === "written") && !hasGateQuestions(course, g.key);
                      const result = enrollment?.assessments?.[g.key];
                      const score = result ? ("scorePct" in result ? result.scorePct : result.overallPct) : undefined;
                      return (
                        <div key={g.key} className={styles.panel} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div>
                            <strong>{g.title}</strong> <span style={{ color: "#4A6375" }}>· weight {g.weight}</span>
                            <div className={styles.line}>{g.who}</div>
                          </div>
                          {typeof score === "number" ? (
                            <Tag color="green">{score}%</Tag>
                          ) : missing ? (
                            <Tag color="default">Questions not set up yet</Tag>
                          ) : (
                            <Tag>Not taken</Tag>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ),
              },
              {
                key: "events",
                label: "Events",
                children: relatedEvents.length ? (
                  <div className={styles.grid}>{relatedEvents.slice(0, 4).map((e) => <EventCard key={e.id} event={e} />)}</div>
                ) : (
                  <Empty description="No upcoming events on this course's topics">
                    <Link href="/training/events">See all events</Link>
                  </Empty>
                ),
              },
            ]}
          />
        </div>

        <aside className={`${styles.panel} ${styles.sticky}`} aria-label="Enrollment">
          <div
            className={styles.thumb}
            style={{ borderRadius: 8, marginBottom: 12, ...(course.thumbnailUrl ? { backgroundImage: `url(${course.thumbnailUrl})` } : {}) }}
          />
          {cert ? (
            <Alert type="success" showIcon title="Certified" description={`Valid until ${cert.expiresAt?.slice(0, 10) ?? "—"}`} style={{ marginBottom: 12 }} />
          ) : enrollment ? (
            <div style={{ marginBottom: 12 }}>
              <div className={styles.line}>{done} of {course.abilities.length} abilities done</div>
              <Progress percent={pct} strokeColor="#1C4463" />
            </div>
          ) : null}
          <Button type="primary" size="large" block loading={busy} onClick={start} disabled={!me}>
            {cta}
          </Button>
          {cert && (
            <Link href="/certifications?mine=1" style={{ display: "block", textAlign: "center", marginTop: 10 }}>
              View certificate
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
