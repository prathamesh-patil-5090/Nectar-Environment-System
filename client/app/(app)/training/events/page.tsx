"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, App, Avatar, Button, Calendar, Empty, Segmented, Select, Skeleton, Tag } from "antd";
import { EnvironmentOutlined, VideoCameraOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { getCommunities, getEvents, joinCommunity, leaveCommunity, type EventsView } from "@/lib/api/training";
import { useAsync, useIsMentor, useViewer } from "@/lib/training/hooks";
import { getSiteName, useTrainingData } from "@/lib/training/store";
import type { TrainingEvent } from "@/lib/training/types";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import { EVENT_TYPE_LABEL, rsvpBadge, spotsText } from "@/components/training/ui/EventCard";
import styles from "@/components/training/ui/training.module.css";

const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const dayLabel = (key: string) => {
  const today = istDay(new Date().toISOString());
  const tomorrow = istDay(new Date(Date.now() + 86400000).toISOString());
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  return new Date(`${key}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });

function EventRow({ e }: { e: TrainingEvent }) {
  const badge = rsvpBadge(e);
  return (
    <Link href={`/training/events/${e.id}`} className={styles.card} style={{ flexDirection: "row", gap: 14, padding: "12px 14px", alignItems: "center" }}>
      <div style={{ width: 54, flexShrink: 0, fontWeight: 700, color: "#1C4463" }}>{time(e.startsAt)}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className={styles.line}>
          {EVENT_TYPE_LABEL[e.type]}
          {e.community ? ` · ${e.community.name}` : ""}
        </div>
        <div className={styles.title} style={{ WebkitLineClamp: 1 }}>{e.title}</div>
        <div className={styles.meta} style={{ marginTop: 4 }}>
          <Avatar size={20} src={e.hosts[0]?.photoUrl}>{e.hosts[0]?.name[0]}</Avatar>
          <span>{e.hosts[0]?.name}</span>
          <span>·</span>
          {e.format === "online" ? <span><VideoCameraOutlined /> Online</span> : <span><EnvironmentOutlined /> {getSiteName(e.venue?.siteId) ?? "At the plant"}</span>}
          <span>· {spotsText(e)}</span>
        </div>
      </div>
      {badge && <Tag color={badge.color} style={{ margin: 0 }}>{badge.text}</Tag>}
    </Link>
  );
}

/** Meetup-style events list: Upcoming · Going · Past · Hosting, grouped by day, with a calendar view. */
export default function EventsPage() {
  const { message } = App.useApp();
  const viewer = useViewer();
  const isMentor = useIsMentor(viewer.personId);
  useTrainingData();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = (params?.get("view") as EventsView) || "upcoming";
  const mode = params?.get("mode") === "calendar" ? "calendar" : "list";
  const format = params?.get("format") ?? "";
  const communityId = params?.get("community") ?? "";
  const hostId = params?.get("host") ?? "";
  const topic = params?.get("topic") ?? "";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params?.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const events = useAsync(
    () => getEvents({ viewerId: viewer.personId, view, format: format || undefined, communityId: communityId || undefined, hostId: hostId || undefined, topic: topic || undefined }),
    [viewer.personId, view, format, communityId, hostId, topic],
  );
  const communities = useAsync(() => getCommunities(viewer.personId), [viewer.personId]);

  const groups = useMemo(() => {
    const map = new Map<string, TrainingEvent[]>();
    for (const e of events.data ?? []) {
      const k = istDay(e.startsAt);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [events.data]);

  const hosts = useMemo(() => {
    const m = new Map<string, string>();
    (events.data ?? []).forEach((e) => e.hosts.forEach((h) => m.set(h.id, h.name)));
    return [...m.entries()];
  }, [events.data]);

  const toggleCommunity = async (slug: string, isMember: boolean) => {
    if (!viewer.personId) return;
    try {
      await (isMember ? leaveCommunity : joinCommunity)(slug, viewer.personId);
      void communities.reload();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  return (
    <div className={styles.page}>
      <TrainingSubNav />
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0B1A24" }}>Events</h1>
          <p style={{ margin: "4px 0 0", color: "#4A6375" }}>Live masterclasses online, and seminars at the plants.</p>
        </div>
        {isMentor && <Button type="primary" onClick={() => router.push("/training/mentor?new=1")}>Create event</Button>}
      </header>

      <div className={styles.twoCol}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Segmented
              value={view}
              onChange={(v) => setParam("view", v === "upcoming" ? null : String(v))}
              options={[
                { value: "upcoming", label: "Upcoming" },
                { value: "going", label: "Going" },
                { value: "past", label: "Past" },
                ...(isMentor ? [{ value: "hosting", label: "Hosting" }] : []),
              ]}
            />
            <Segmented
              value={mode}
              onChange={(v) => setParam("mode", v === "list" ? null : String(v))}
              options={[{ value: "list", label: "List" }, { value: "calendar", label: "Calendar" }]}
            />
            <Select allowClear placeholder="Format" value={format || undefined} onChange={(v) => setParam("format", v ?? null)} style={{ width: 130 }} options={[{ value: "online", label: "Online" }, { value: "in_person", label: "At a plant" }]} />
            <Select allowClear placeholder="Community" value={communityId || undefined} onChange={(v) => setParam("community", v ?? null)} style={{ width: 200 }} options={(communities.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
            <Select allowClear placeholder="Host" value={hostId || undefined} onChange={(v) => setParam("host", v ?? null)} style={{ width: 180 }} options={hosts.map(([value, label]) => ({ value, label }))} />
            {topic && <Tag closable onClose={() => setParam("topic", null)}>Topic: {topic}</Tag>}
          </div>

          {events.error ? (
            <Alert type="error" showIcon title="Couldn't load events" description={events.error} action={<Button onClick={events.reload}>Try again</Button>} />
          ) : events.loading ? (
            <Skeleton active />
          ) : mode === "calendar" ? (
            <div className={styles.panel}>
              <Calendar
                fullscreen={false}
                cellRender={(d: Dayjs, info) => {
                  if (info.type !== "date") return info.originNode;
                  const list = (events.data ?? []).filter((e) => istDay(e.startsAt) === d.format("YYYY-MM-DD"));
                  return list.length ? <div style={{ display: "flex", justifyContent: "center" }}><Tag color="#1C4463" style={{ margin: 0 }}>{list.length}</Tag></div> : null;
                }}
                onSelect={(d, info) => {
                  if (info.source !== "date") return;
                  const first = (events.data ?? []).find((e) => istDay(e.startsAt) === d.format("YYYY-MM-DD"));
                  if (first) router.push(`/training/events/${first.id}`);
                }}
                defaultValue={dayjs()}
              />
            </div>
          ) : groups.length === 0 ? (
            <div className={styles.panel}>
              <Empty description={view === "going" ? "You haven't registered for any events" : view === "hosting" ? "You aren't hosting any events" : "No events found"} />
            </div>
          ) : (
            groups.map(([key, list]) => (
              <section key={key} style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-label={dayLabel(key)}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0B1A24" }}>{dayLabel(key)}</h2>
                {list.map((e) => <EventRow key={e.id} e={e} />)}
              </section>
            ))
          )}
        </div>

        <aside className={styles.panel} aria-label="Communities">
          <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>Communities</h2>
          {communities.loading ? (
            <Skeleton active />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(communities.data ?? []).map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/training/communities/${c.slug}`} style={{ fontWeight: 600 }}>{c.name}</Link>
                    <div className={styles.line}>{c.memberCount} members</div>
                  </div>
                  <Button size="small" type={c.isMember ? "default" : "primary"} onClick={() => toggleCommunity(c.slug, c.isMember)}>
                    {c.isMember ? "Joined" : "Join"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
