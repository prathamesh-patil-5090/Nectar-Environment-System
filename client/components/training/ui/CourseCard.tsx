"use client";

import Link from "next/link";
import { Progress, Tag } from "antd";
import { StarFilled } from "@ant-design/icons";
import type { CourseCardData } from "@/lib/training/types";
import Cover from "./Cover";

export type CourseBadge = { text: string; color: string };

/** Course image card (same look as the event cards). The whole card is the link; at most one badge. */
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
    <Link
      href={`/training/course/${course.id}`}
      aria-label={`${course.title} (${course.code})`}
      className="group flex flex-col gap-3 min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-emerald-600"
    >
      <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80">
        <Cover src={course.thumbnailUrl} label={course.title} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/65 text-white backdrop-blur-sm">
          {course.code}
        </span>
        {badge && (
          <Tag color={badge.color} className="absolute! top-3 right-3 m-0! rounded-full! font-semibold shadow-sm">
            {badge.text}
          </Tag>
        )}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <h3 className="m-0 text-base font-bold text-slate-900 leading-snug line-clamp-2 group-hover:underline">{course.title}</h3>
        {reason ? (
          <div className="text-sm font-medium text-[#1C4463] line-clamp-2">{reason}</div>
        ) : (
          skills && <div className="text-sm text-slate-500 truncate" title={course.skills.join(", ")}>{skills}</div>
        )}
        {typeof progressPct === "number" && (
          <Progress percent={progressPct} size="small" strokeColor="#1C4463" railColor="#e2e8f0" aria-label="Progress" className="m-0!" />
        )}
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 mt-0.5">
          {typeof course.rating === "number" && (
            <span className="font-semibold text-slate-700">
              <StarFilled className="text-amber-500" /> {course.rating.toFixed(1)}
              {course.reviewCount ? <span className="font-normal text-slate-400"> ({course.reviewCount})</span> : null}
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
