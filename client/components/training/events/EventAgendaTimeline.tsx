"use client";

import { ClockCircleOutlined } from "@ant-design/icons";

interface AgendaItem {
  time: string;
  item: string;
}

interface EventAgendaTimelineProps {
  agenda: AgendaItem[];
}

export default function EventAgendaTimeline({ agenda }: EventAgendaTimelineProps) {
  if (!agenda || agenda.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <ClockCircleOutlined className="text-emerald-600" />
        <span>Session Agenda</span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
        {agenda.map((slot, index) => (
          <div key={`${slot.time}-${index}`} className="relative flex items-start gap-3">
            {/* Timeline bullet node */}
            <div className="absolute -left-6 top-1 w-[22px] h-[22px] rounded-full bg-white border-2 border-emerald-600 flex items-center justify-center shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            </div>

            {/* Time badge and title */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-2xs">
              <div className="text-sm font-semibold text-slate-800 leading-snug">
                {slot.item}
              </div>
              <span className="text-xs font-mono font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md self-start sm:self-auto shrink-0">
                {slot.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
