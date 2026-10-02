"use client";

import Link from "next/link";
import { Avatar, Tag } from "antd";
import { EnvironmentOutlined, VideoCameraOutlined } from "@ant-design/icons";
import type { TrainingEvent } from "@/lib/training/types";
import { dayParts, fmtIst } from "@/lib/training/hooks";
import { getSiteName } from "@/lib/training/store";
import styles from "./training.module.css";

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
