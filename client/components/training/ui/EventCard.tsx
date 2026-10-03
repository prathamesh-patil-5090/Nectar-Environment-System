"use client";

import Link from "next/link";
import { Avatar, Tag } from "antd";
import { EnvironmentOutlined, VideoCameraOutlined } from "@ant-design/icons";
import type { TrainingEvent } from "@/lib/training/types";
import { dayParts, fmtIst } from "@/lib/training/hooks";
import { getSiteName } from "@/lib/training/store";
import styles from "./training.module.css";
import Cover from "./Cover";

export const EVENT_TYPE_LABEL: Record<TrainingEvent["type"], string> = {
  masterclass: "Masterclass",
  seminar: "Seminar",
  workshop: "Workshop",
  clinic: "Clinic",
};

export function rsvpBadge(ev: TrainingEvent): { text: string; color: string } | null {
  if (ev.status === "cancelled") return { text: "Cancelled", color: "red" };
  if (ev.status === "draft") return { text: "Draft", color: "default" };
  if (ev.isHost) return { text: "Hosting", color: "purple" };
  const r = ev.myRsvp?.status;
  if (r === "going") return { text: "Going ✓", color: "green" };
  if (r === "attended") return { text: "Attended", color: "green" };
  if (r === "waitlist") return { text: `Waitlist #${ev.myRsvp?.waitlistPosition ?? ""}`, color: "gold" };
  return null;
}

export function spotsText(ev: TrainingEvent): string {
  if (ev.spotsLeft > 0) return `${ev.spotsLeft} of ${ev.capacity} spots left`;
  return ev.waitlistCount ? `Full · ${ev.waitlistCount} on waitlist` : "Full";
}

/** The event's own cover; undefined → callers show a theme gradient (never another card's photo). */
export function eventCoverUrl(ev: TrainingEvent): string | undefined {
  return ev.coverUrl || undefined;
}

/** The community's own cover; undefined → callers show its initials. */
export function communityCoverUrl(c: { coverUrl?: string }): string | undefined {
  return c.coverUrl || undefined;
}

/** Meetup-style image card: cover, title, date, organiser, attendee avatars + count. */
export function EventImageCard({ event }: { event: TrainingEvent }) {
  const badge = rsvpBadge(event);
  const by = event.community?.name ?? event.hosts[0]?.name;
  const preview = event.attendeePreview ?? [];
  return (
    <Link href={`/training/events/${event.id}`} aria-label={event.title} className="group flex flex-col gap-3 min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-emerald-600">
      <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80">
        <Cover src={eventCoverUrl(event)} label={event.title} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        {event.format === "online" && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/65 text-white backdrop-blur-sm">
            <VideoCameraOutlined /> Online
          </span>
        )}
        {badge && (
          <Tag color={badge.color} className="absolute! top-3 right-3 m-0! rounded-full! font-semibold shadow-sm">
            {badge.text}
          </Tag>
        )}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <h3 className="m-0 text-base font-bold text-slate-900 leading-snug line-clamp-2 group-hover:underline">{event.title}</h3>
        <div className="text-sm text-slate-500">{fmtIst(event.startsAt)}</div>
        {by && <div className="text-sm text-slate-500 truncate">by {by}</div>}
        {event.assignedBy && (
          <div className="text-xs font-semibold text-[#1C4463] truncate">Assigned by {event.assignedBy.name}</div>
        )}
        <div className="flex items-center gap-2 mt-1.5 text-sm">
          {preview.length > 0 && (
            <Avatar.Group size={24} max={{ count: 3 }}>
              {preview.map((p) => (
                <Avatar key={p.id} src={p.photoUrl} className="bg-emerald-700">{p.name[0]}</Avatar>
              ))}
            </Avatar.Group>
          )}
          <span className="font-semibold text-slate-900">
            {event.goingCount} {event.goingCount === 1 ? "attendee" : "attendees"}
          </span>
          <span className="text-slate-400 text-xs truncate">· {spotsText(event)}</span>
        </div>
      </div>
    </Link>
  );
}

/** Meetup-style event card: date badge, title, host, format, spots. */
export default function EventCard({ event, venueName }: { event: TrainingEvent; venueName?: string }) {
  const { month, day } = dayParts(event.startsAt);
  const host = event.hosts[0];
  const badge = rsvpBadge(event);
  return (
    <Link href={`/training/events/${event.id}`} className={styles.card} aria-label={event.title}>
      <div className={styles.body} style={{ gap: 10 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div className={styles.dateBadge} aria-hidden>
            <div className={styles.dateBadgeMonth}>{month}</div>
            <div className={styles.dateBadgeDay}>{day}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className={styles.line}>
              {EVENT_TYPE_LABEL[event.type]} · {fmtIst(event.startsAt)}
            </div>
            <h3 className={styles.title}>{event.title}</h3>
          </div>
        </div>
        {host && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar size={24} src={host.photoUrl}>{host.name[0]}</Avatar>
            <span className={styles.line}>Hosted by {host.name}</span>
          </div>
        )}
        <div className={styles.meta}>
          {event.format === "online" ? (
            <span><VideoCameraOutlined /> Online</span>
          ) : (
            <span><EnvironmentOutlined /> {venueName ?? getSiteName(event.venue?.siteId) ?? "At the plant"}</span>
          )}
          <span>· {spotsText(event)}</span>
          {badge && <Tag color={badge.color} style={{ marginLeft: "auto", marginRight: 0 }}>{badge.text}</Tag>}
        </div>
      </div>
    </Link>
  );
}
