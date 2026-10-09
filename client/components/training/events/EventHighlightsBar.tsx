"use client";

import {
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import type { TrainingEvent } from "@/lib/training/types";
import { getSiteName } from "@/lib/training/store";
import { tr, trTable, trData } from "@/lib/i18n";

const ROLE_LABEL: Record<string, string> = trTable({
  employee: "Plant Operators",
  shift_incharge: "Shift In-Charges",
  supervisor: "Site Managers",
  safety_incharge: "Safety In-Charges",
  site_incharge: "Site In-Charges",
  manager: "Plant Managers",
  hr: "HR & Training Lead",
});

export default function EventHighlightsBar({ event }: { event: TrainingEvent }) {
  const audienceText =
    (event.audience?.roles?.length ?? 0) > 0
      ? event.audience.roles!.map((r) => ROLE_LABEL[r] ?? r).join(", ")
      : tr("Open to All Plant Personnel");

  const venueTitle =
    event.format === "online"
      ? tr("Google Meet Online")
      : event.venue?.siteId
      ? getSiteName(event.venue.siteId)
      : tr("Plant Site");

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-sm">
      {/* 1. Format */}
      <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/70 border border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          {event.format === "online" ? <VideoCameraOutlined /> : <EnvironmentOutlined />}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{tr("Format")}</div>
          <div className="text-xs font-bold text-slate-800 truncate" title={trData(venueTitle)}>
            {event.format === "online" ? tr("Virtual Live") : tr("On-Site Workshop")}
          </div>
        </div>
      </div>

      {/* 2. Free / Sponsored */}
      <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/70 border border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <ThunderboltOutlined />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{tr("Admission")}</div>
          <div className="text-xs font-bold text-slate-800 truncate">{tr("100% Free · Nectar")}</div>
        </div>
      </div>

      {/* 3. Capacity */}
      <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/70 border border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <TeamOutlined />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{tr("Capacity")}</div>
          <div className="text-xs font-bold text-slate-800 truncate">
            {event.spotsLeft > 0 ? tr("{spotsLeft} spots left", { spotsLeft: event.spotsLeft }) : tr("Waitlist Open")}
          </div>
        </div>
      </div>

      {/* 4. Target Audience */}
      <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/70 border border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
          <SafetyCertificateOutlined />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{tr("Audience")}</div>
          <div className="text-xs font-bold text-slate-800 truncate" title={trData(audienceText)}>
            {trData(audienceText)}
          </div>
        </div>
      </div>
    </div>
  );
}
