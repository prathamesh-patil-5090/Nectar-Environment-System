"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, App, Button, Empty, Segmented, Select, Skeleton, Tag } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getCommunities, getEvents, joinCommunity, leaveCommunity, type EventsView } from "@/lib/api/training";
import { useAsync, useIsMentor, useViewer } from "@/lib/training/hooks";
import { useTrainingData } from "@/lib/training/store";
import type { Community, TrainingEvent } from "@/lib/training/types";
import { EventImageCard, communityCoverUrl } from "@/components/training/ui/EventCard";
import styles from "@/components/training/ui/training.module.css";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";

/** Background refresh so counts, RSVPs and new events stay current. */
const REFRESH_MS = 30_000;

const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const dayLabel = (key: string) => {
  const today = istDay(new Date().toISOString());
  const tomorrow = istDay(new Date(Date.now() + 86400000).toISOString());
  if (key === today) return "Today";
  if (key === tomorrow) return "Tomorrow";
  return new Date(`${key}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

function CommunityThumb({ c }: { c: Community }) {
  const src = communityCoverUrl(c);
  return src ? (
    <img src={src} alt="" className="w-24 aspect-[16/9] rounded-xl object-cover shrink-0 bg-slate-100" />
  ) : (
    <div className="w-24 aspect-[16/9] rounded-xl shrink-0 bg-gradient-to-br from-emerald-700 to-slate-800 text-white font-bold flex items-center justify-center">
      {c.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
    </div>
  );
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Month grid: days with the viewer's registrations are highlighted and jump to that day in the list; today is ringed. */
function MiniCalendar({ eventsByDay }: { eventsByDay: Map<string, TrainingEvent[]> }) {
  const [month, setMonth] = useState(() => dayjs().startOf("month"));
  const today = istDay(new Date().toISOString());
  const start = month.startOf("week");
  const weeks = Math.ceil((month.daysInMonth() + month.day()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => start.add(i, "day"));
  const monthTotal = [...eventsByDay.entries()].filter(([k]) => k.startsWith(month.format("YYYY-MM"))).reduce((n, [, l]) => n + l.length, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-lg font-bold text-slate-900 leading-tight">{month.format("MMMM YYYY")}</div>
          <div className="text-xs text-slate-500">
            {monthTotal ? `${monthTotal} registered event${monthTotal === 1 ? "" : "s"} this month` : "No registrations this month"}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button type="text" shape="circle" size="small" icon={<LeftOutlined />} aria-label="Previous month" onClick={() => setMonth((m) => m.subtract(1, "month"))} />
          <Button type="text" size="small" className="text-xs font-semibold" onClick={() => setMonth(dayjs().startOf("month"))}>Today</Button>
          <Button type="text" shape="circle" size="small" icon={<RightOutlined />} aria-label="Next month" onClick={() => setMonth((m) => m.add(1, "month"))} />
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400 mb-1">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {days.map((d) => {
          const key = d.format("YYYY-MM-DD");
          const count = eventsByDay.get(key)?.length ?? 0;
          const inMonth = d.month() === month.month();
          const isToday = key === today;
          return (
            <div key={key} className="flex justify-center">
              <button
                type="button"
                disabled={!count}
                title={count ? `${count} event${count === 1 ? "" : "s"}` : undefined}
                onClick={() => document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={[
                  "relative w-9 h-9 rounded-full text-sm flex items-center justify-center transition-colors",
                  count
                    ? "bg-emerald-600 text-white font-bold cursor-pointer hover:bg-emerald-700"
                    : inMonth ? "text-slate-700 cursor-default" : "text-slate-300 cursor-default",
                  isToday && !count ? "ring-2 ring-emerald-600 font-bold text-emerald-700" : "",
                  isToday && count ? "ring-2 ring-offset-2 ring-emerald-600" : "",
                ].join(" ")}
              >
                {d.date()}
                {count > 1 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-slate-900 text-white text-[10px] leading-4 font-bold">
                    {count}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
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

  // Live updates: poll while the tab is visible, and refresh as soon as it regains focus
  const { reload: reloadEvents } = events;
  const { reload: reloadCommunities } = communities;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void reloadEvents();
      void reloadCommunities();
    };
    const t = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reloadEvents, reloadCommunities]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, TrainingEvent[]>();
    for (const e of events.data ?? []) {
      const k = istDay(e.startsAt);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [events.data]);
  const groups = [...eventsByDay.entries()];
  // Calendar marks only days where the viewer has registered (going, waitlisted or attended)
  const registeredByDay = useMemo(() => {
    const map = new Map<string, TrainingEvent[]>();
    for (const [k, list] of eventsByDay) {
      const mine = list.filter((e) => ["going", "waitlist", "attended"].includes(e.myRsvp?.status ?? ""));
      if (mine.length) map.set(k, mine);
    }
    return map;
  }, [eventsByDay]);

  const hosts = useMemo(() => {
    const m = new Map<string, string>();
    (events.data ?? []).forEach((e) => e.hosts.forEach((h) => m.set(h.id, h.name)));
    return [...m.entries()];
  }, [events.data]);

  const myCommunities = (communities.data ?? []).filter((c) => c.isMember);
  const otherCommunities = (communities.data ?? []).filter((c) => !c.isMember);

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
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
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
            <Select allowClear placeholder="Format" value={format || undefined} onChange={(v) => setParam("format", v ?? null)} style={{ width: 130 }} options={[{ value: "online", label: "Online" }, { value: "in_person", label: "At a plant" }]} />
            <Select allowClear placeholder="Community" value={communityId || undefined} onChange={(v) => setParam("community", v ?? null)} style={{ width: 200 }} options={(communities.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
            <Select allowClear placeholder="Host" value={hostId || undefined} onChange={(v) => setParam("host", v ?? null)} style={{ width: 180 }} options={hosts.map(([value, label]) => ({ value, label }))} />
            {topic && <Tag closable onClose={() => setParam("topic", null)}>Topic: {topic}</Tag>}
          </div>

          {events.error ? (
            <Alert type="error" showIcon title="Couldn't load events" description={events.error} action={<Button onClick={events.reload}>Try again</Button>} />
          ) : events.loading && !events.data ? (
            <Skeleton active />
          ) : groups.length === 0 ? (
            <div className={styles.panel}>
              <Empty description={view === "going" ? "You haven't registered for any events" : view === "hosting" ? "You aren't hosting any events" : "No events found"} />
            </div>
          ) : (
            // One grid, cards flow left to right in date order; the first card of each day is the calendar's scroll target
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-7">
              {groups.flatMap(([key, list]) =>
                list.map((e, i) => (
                  <div key={e.id} id={i === 0 ? `day-${key}` : undefined} aria-label={i === 0 ? dayLabel(key) : undefined} className="scroll-mt-4 min-w-0">
                    <EventImageCard event={e} />
                  </div>
                )),
              )}
            </div>
          )}
        </div>

        <aside aria-label="Calendar and communities" className="flex flex-col gap-4">
          <MiniCalendar eventsByDay={registeredByDay} />

          <div className="bg-white border border-slate-200 rounded-3xl p-5">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="m-0 text-lg font-bold text-slate-900">
                Your communities <span className="font-normal text-slate-500 ml-1">{myCommunities.length}</span>
              </h2>
            </div>
            {communities.loading && !communities.data ? (
              <Skeleton active />
            ) : myCommunities.length === 0 ? (
              <p className="m-0 text-sm text-slate-500">You haven&apos;t joined any communities yet.</p>
            ) : (
              <ul className="m-0 p-0 list-none divide-y divide-slate-100">
                {myCommunities.map((c) => (
                  <li key={c.id}>
                    <Link href={`/training/communities/${c.slug}`} className="group flex items-center gap-4 py-3">
                      <CommunityThumb c={c} />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 leading-snug line-clamp-2 group-hover:underline">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.memberCount} members</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {otherCommunities.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-5">
              <h2 className="m-0 mb-2 text-base font-bold text-slate-900">Discover communities</h2>
              <ul className="m-0 p-0 list-none divide-y divide-slate-100">
                {otherCommunities.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <Link href={`/training/communities/${c.slug}`} className="group flex items-center gap-3 min-w-0 flex-1">
                      <CommunityThumb c={c} />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-900 leading-snug line-clamp-2 group-hover:underline">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.memberCount} members</div>
                      </div>
                    </Link>
                    <Button size="small" type="primary" onClick={() => toggleCommunity(c.slug, false)} icon={<RightOutlined />} iconPlacement="end">
                      Join
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
