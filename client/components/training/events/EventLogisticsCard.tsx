"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Avatar, Button, Dropdown, Progress, message } from "antd";
import {
  CalendarOutlined,
  CopyOutlined,
  DownOutlined,
  EnvironmentOutlined,
  ExportOutlined,
  GlobalOutlined,
  LockOutlined,
  ShareAltOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  WindowsOutlined,
} from "@ant-design/icons";
import type { TrainingEvent } from "@/lib/training/types";
import { dayParts, fmtTimeRange } from "@/lib/training/hooks";
import { getSiteName } from "@/lib/training/store";
import { eventCalendarUrl } from "@/lib/api/training";
import { tr, intlLocale, trData } from "@/lib/i18n";

interface EventLogisticsCardProps {
  event: TrainingEvent;
  primaryAction: React.ReactNode;
  going: boolean;
  phase: string;
}

export default function EventLogisticsCard({
  event,
  primaryAction,
  going,
  phase,
}: EventLogisticsCardProps) {
  const [copied, setCopied] = useState(false);
  const { month, day } = dayParts(event.startsAt);
  const startDate = new Date(event.startsAt);
  const endDate = new Date(event.endsAt);

  const fullDateStr = startDate.toLocaleDateString(intlLocale(), {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const venueTitle =
    event.format === "online"
      ? tr("Google Meet Virtual Room")
      : [getSiteName(event.venue?.siteId) ?? tr("Plant Site"), event.venue?.room]
          .filter(Boolean)
          .join(" · ");

  // Google Calendar URL generator
  const makeGoogleCalUrl = () => {
    const fmtGCal = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(
      `${event.description}\n\nSession hosted on Nectar Enviro Ops Training Platform.`
    );
    const location = encodeURIComponent(
      event.format === "online" ? (event.meetLink || tr("Google Meet")) : venueTitle
    );
    const dates = `${fmtGCal(startDate)}/${fmtGCal(endDate)}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  };

  // Outlook Calendar URL generator
  const makeOutlookCalUrl = () => {
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || "");
    const location = encodeURIComponent(venueTitle);
    return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${details}&location=${location}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      message.success(tr("Event link copied to clipboard!"));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      message.error(tr("Failed to copy link"));
    }
  };

  // Capacity calculation
  const capacityPct = Math.min(
    100,
    Math.round(((event.capacity - event.spotsLeft) / (event.capacity || 1)) * 100)
  );

  return (
    <aside aria-label={tr("Event details and registration")} className="flex flex-col gap-4">
      {/* 1. Community Mini Widget (Meetup Signature) */}
      {event.community && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-800 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
              <TeamOutlined className="text-lg" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {tr("Organizing Circle")}
              </div>
              <Link
                href={`/training/communities/${event.community.slug}`}
                className="font-bold text-sm text-slate-900 hover:text-emerald-700 transition-colors truncate block"
              >
                {trData(event.community.name)}
              </Link>
              <div className="text-xs text-slate-500">{tr("Public Engineering Community")}</div>
            </div>
          </div>

          <Link
            href={`/training/communities/${event.community.slug}`}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:border-emerald-600 hover:text-emerald-700 transition-colors shrink-0"
          >
            {tr("Visit Circle")}
          </Link>
        </div>
      )}

      {/* 2. Main Sticky Action Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-md flex flex-col gap-5">
        {/* Date & Time with Meetup Date Tile */}
        <div className="flex items-start gap-3.5">
          {/* Calendar Tile */}
          <div className="w-13 h-14 rounded-xl border border-slate-200 overflow-hidden flex flex-col text-center shadow-xs shrink-0 bg-white">
            <div className="bg-red-700 text-white text-[10px] font-bold uppercase tracking-wider py-0.5">
              {trData(month)}
            </div>
            <div className="flex-1 flex items-center justify-center font-extrabold text-xl text-slate-900 leading-none">
              {trData(day)}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {tr("Date & Time")}
            </div>
            <div className="font-bold text-sm text-slate-900 leading-snug">
              {trData(fullDateStr)}
            </div>
            <div className="text-xs font-medium text-emerald-800 mt-0.5">
              {tr("{timeRange} IST", { timeRange: fmtTimeRange(event.startsAt, event.endsAt) })}
            </div>

            {/* Calendar Export Dropdown */}
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  {
                    key: "gcal",
                    icon: <GlobalOutlined className="text-blue-600" />,
                    label: (
                      <a href={makeGoogleCalUrl()} target="_blank" rel="noreferrer">
                        {tr("Google Calendar")}
                      </a>
                    ),
                  },
                  {
                    key: "ics",
                    icon: <CalendarOutlined className="text-emerald-600" />,
                    label: <a href={eventCalendarUrl(event.id)}>{tr("Apple / iCal (.ics)")}</a>,
                  },
                  {
                    key: "outlook",
                    icon: <WindowsOutlined className="text-blue-700" />,
                    label: (
                      <a href={makeOutlookCalUrl()} target="_blank" rel="noreferrer">
                        {tr("Outlook Calendar")}
                      </a>
                    ),
                  },
                ],
              }}
            >
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
              >
                <CalendarOutlined />{" "}{tr("Add to Calendar")}{" "}<DownOutlined className="text-[9px]" />
              </button>
            </Dropdown>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* Location & Meeting Box */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
            {event.format === "online" ? <VideoCameraOutlined /> : <EnvironmentOutlined />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {tr("Location")}
            </div>
            <div className="font-bold text-sm text-slate-900">
              {trData(venueTitle)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {event.format === "online" ? (
                going || event.isHost ? (
                  event.meetLink ? (
                    <span className="text-emerald-700 font-medium">
                      {tr("Join link ready · opens 10 min before start")}
                    </span>
                  ) : (
                    tr("Virtual link will be posted prior to session.")
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <LockOutlined className="text-[10px]" />{" "}{tr("Link visible for attendees")}
                  </span>
                )
              ) : (
                tr("Physical attendance at the plant")
              )}
            </div>
          </div>
        </div>

        {/* Capacity & Progress Bar */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">{tr("Reserved Seats")}</span>
            <span className="font-bold text-slate-900">
              {event.capacity - event.spotsLeft} / {event.capacity}
            </span>
          </div>
          <Progress
            percent={capacityPct}
            showInfo={false}
            strokeColor="#16a34a"
            railColor="#e2e8f0"
            size="small"
          />
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>
              {event.spotsLeft > 0 ? tr("{spotsLeft} spots available", { spotsLeft: event.spotsLeft }) : tr("Session is at capacity")}
            </span>
            {event.waitlistCount > 0 && <span>{tr("{waitlistCount} waiting", { waitlistCount: event.waitlistCount })}</span>}
          </div>
        </div>

        {/* Primary Action Button (The High-Emphasis CTA) */}
        <div className="flex flex-col gap-2.5">
          <div className="w-full [&>button]:w-full [&>button]:h-12 [&>button]:text-base [&>button]:font-bold [&>button]:rounded-xl [&>button]:shadow-sm">
            {primaryAction}
          </div>

          {/* Registration closure countdown or alert */}
          {event.rsvpClosesAt && phase !== "ended" && (
            <div className="text-center text-[11px] text-slate-500 font-medium">
              {tr("Registration closes")}{" "}
              {new Date(event.rsvpClosesAt).toLocaleString(intlLocale(), {
                timeZone: "Asia/Kolkata",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          )}
        </div>

        {/* Share & Quick Link */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <Button
            type="text"
            icon={<ShareAltOutlined />}
            onClick={handleCopyLink}
            className="text-xs font-semibold text-slate-600 hover:text-emerald-700 p-0 flex items-center gap-1.5"
          >
            {copied ? tr("Link Copied!") : tr("Share Masterclass")}
          </Button>

          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={handleCopyLink}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            {tr("Copy URL")}
          </Button>
        </div>
      </div>
    </aside>
  );
}
