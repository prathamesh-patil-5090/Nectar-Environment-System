"use client";

import Link from "next/link";
import { Progress, Tag } from "antd";
import { StarFilled } from "@ant-design/icons";
import type { CourseCardData } from "@/lib/training/types";
import styles from "./training.module.css";

export type CourseBadge = { text: string; color: string };

/** One course card (Coursera-style). The whole card is the link; at most one badge. */
export default function CourseCard({
  course,
  badge,
  reason,
  progressPct,
}: {
  course: CourseCardData;
  badge?: CourseBadge;
  reason?: string;
  progressPct?: number;
}) {
  const skills = course.skills.slice(0, 3).join(" · ");
  return (
    <Link href={`/training/course/${course.id}`} className={styles.card} aria-label={`${course.title} (${course.code})`}>
      <div
        className={styles.thumb}
        style={course.thumbnailUrl ? { backgroundImage: `url(${course.thumbnailUrl})` } : undefined}
      >
        {badge && (
          <Tag color={badge.color} style={{ position: "absolute", top: 8, left: 8, margin: 0, fontWeight: 600 }}>
            {badge.text}
          </Tag>
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.line}>
          {course.code}
          {course.provider ? ` · ${course.provider}` : ""}
        </div>
        <h3 className={styles.title}>{course.title}</h3>
        {reason ? (
          <div className={styles.reason}>{reason}</div>
        ) : (
          skills && <div className={styles.line} title={course.skills.join(", ")}>Skills: {skills}</div>
        )}
        {typeof progressPct === "number" && (
          <Progress percent={progressPct} size="small" strokeColor="#1C4463" aria-label="Progress" />
        )}
        <div className={styles.meta}>
          {typeof course.rating === "number" && (
            <span>
              <StarFilled style={{ color: "#D97706" }} /> {course.rating.toFixed(1)}
              {course.reviewCount ? ` (${course.reviewCount})` : ""}
            </span>
          )}
          {course.level && <span>· {course.level}</span>}
          {course.estimatedHours ? <span>· {course.estimatedHours} h</span> : null}
          <span>· {course.abilityCount} {course.abilityCount === 1 ? "ability" : "abilities"}</span>
        </div>
      </div>
    </Link>
  );
}
