"use client";

import { CalendarOutlined } from "@ant-design/icons";
import type { TrainingEvent } from "@/lib/training/types";
import { fmtTimeRange } from "@/lib/training/hooks";
import { eventCalendarUrl } from "@/lib/api/training";
import { tr, trData } from "@/lib/i18n";

interface EventStickyBottomBarProps {
  event: TrainingEvent;
  primaryAction: React.ReactNode;
  going: boolean;
  phase: string;
}

export default function EventStickyBottomBar({
  event,
  primaryAction,
  going,
  phase,
}: EventStickyBottomBarProps) {
  return (
    <div className="sticky bottom-0 z-10 mt-8 bg-white/95 backdrop-blur-md border-t border-x border-slate-200/90 shadow-[0_-6px_20px_-4px_rgba(15,23,42,0.1)] py-3 px-4 sm:px-6 rounded-t-2xl transition-all">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left Info Snippet */}
        <div className="min-w-0 flex items-center gap-3">
          <div className="hidden md:flex flex-col">
            <span className="text-xs font-semibold text-emerald-800">
              {tr("{timeRange} IST", { timeRange: fmtTimeRange(event.startsAt, event.endsAt) })}
            </span>
            <span className="text-sm font-bold text-slate-900 truncate max-w-md" title={trData(event.title)}>
              {trData(event.title)}
            </span>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
            {event.spotsLeft > 0 ? tr("{spotsLeft} spots available", { spotsLeft: event.spotsLeft }) : tr("Capacity reached")}
          </div>
        </div>

        {/* Right CTA dock */}
        <div className="flex items-center gap-3 shrink-0">
          {going && phase !== "ended" && (
            <a
              href={eventCalendarUrl(event.id)}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
            >
              <CalendarOutlined />{" "}{tr("Add to Calendar")}
            </a>
          )}
          <div className="[&>button]:h-10 [&>button]:px-6 [&>button]:rounded-xl [&>button]:font-bold [&>button]:text-sm shadow-xs">
            {primaryAction}
          </div>
        </div>
      </div>
    </div>
  );
}
