"use client";

import Link from "next/link";
import type { CourseCardData, TrainingAssignment } from "@/lib/training/types";
import Cover from "./Cover";
import { tr, trData } from "@/lib/i18n";

/** A manager's weak-area flag, linking to the flagged course, a match, or a catalog search. */
export default function SuggestionCard({
  assignment: a,
  course,
  matches,
}: {
  assignment: TrainingAssignment;
  course?: CourseCardData;
  matches: CourseCardData[];
}) {
  const what = a.topic || a.skills?.join(", ") || course?.title || "Training";
  const target = course ?? matches[0];
  const href = target ? `/training/course/${target.id}` : `/training/explore?q=${encodeURIComponent(a.topic ?? a.skills?.[0] ?? "")}`;
  return (
    <Link href={href} className="group flex flex-col gap-3 min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-emerald-600">
      <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80">
        <Cover src={target?.thumbnailUrl} label={trData(what)} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#1C4463] text-white">
          {tr("Suggested by {assignedByName}", { assignedByName: trData(a.assignedByName) })}
        </span>
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <h3 className="m-0 text-base font-bold text-slate-900 leading-snug line-clamp-2 group-hover:underline">{trData(what)}</h3>
        <div className="text-sm text-slate-500 line-clamp-2">{trData(a.reason)}</div>
        <div className="text-sm font-semibold text-emerald-700">
          {course ? tr("Course: {code}", { code: course.code }) : matches.length ? tr("Try: {join}", { join: matches.map((m) => m.code).join(", ") }) : tr("Find matching training →")}
        </div>
      </div>
    </Link>
  );
}
