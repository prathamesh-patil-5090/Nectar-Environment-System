"use client";

import Link from "next/link";
import { Avatar, Skeleton } from "antd";
import { getCommunities, getMentors } from "@/lib/api/training";
import { fmtIst, useAsync } from "@/lib/training/hooks";
import type { TrainingEvent } from "@/lib/training/types";
import { communityCoverUrl, eventCoverUrl } from "./EventCard";
import Cover from "./Cover";

const PANEL = "bg-white border border-slate-200 rounded-3xl p-5";

function PanelHead({ title, count, href }: { title: string; count?: number; href: string }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <h2 className="m-0 text-lg font-bold text-slate-900">
        {title}
        {typeof count === "number" && <span className="font-normal text-slate-500 ml-1.5">{count}</span>}
      </h2>
      <Link href={href} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">See all</Link>
    </div>
  );
}

/** Right-hand column of the learner pages: next events, mentors and the viewer's communities. */
export default function TrainingSidebar({ personId, events, eventsLoading }: { personId?: string; events?: TrainingEvent[]; eventsLoading?: boolean }) {
  const mentors = useAsync(() => getMentors(), []);
  const communities = useAsync(() => getCommunities(personId), [personId]);
  const mine = (communities.data ?? []).filter((c) => c.isMember);

  return (
    <aside aria-label="Events, mentors and communities" className="flex flex-col gap-4 lg:sticky lg:top-4">
      <div className={PANEL}>
        <PanelHead title="Upcoming events" count={events?.length} href="/training/events" />
        {eventsLoading && !events ? (
          <Skeleton active />
        ) : !events?.length ? (
          <p className="m-0 text-sm text-slate-500">No upcoming events.</p>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-slate-100">
            {events.slice(0, 3).map((e) => (
              <li key={e.id}>
                <Link href={`/training/events/${e.id}`} className="group flex items-center gap-3 py-3">
                  <div className="w-20 aspect-[16/9] rounded-xl overflow-hidden shrink-0 bg-slate-100">
                    <Cover src={eventCoverUrl(e)} label={e.title} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-emerald-700">{fmtIst(e.startsAt)}</div>
                    <div className="font-semibold text-sm text-slate-900 leading-snug line-clamp-2 group-hover:underline">{e.title}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={PANEL}>
        <PanelHead title="Mentors" count={mentors.data?.length} href="/training/mentors" />
        {mentors.loading && !mentors.data ? (
          <Skeleton active avatar />
        ) : !mentors.data?.length ? (
          <p className="m-0 text-sm text-slate-500">No mentors yet.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-3 pt-1">
            {mentors.data.slice(0, 4).map((m) => (
              <li key={m.employeeId}>
                <Link href={`/training/mentors/${encodeURIComponent(m.employeeId)}`} className="group flex items-center gap-3">
                  <Avatar size={44} src={m.photoUrl} className="bg-[#1C4463] shrink-0">{m.name[0]}</Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate group-hover:underline">{m.name}</div>
                    <div className="text-xs text-slate-500 truncate">{m.title}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={PANEL}>
        <PanelHead title="Your communities" count={mine.length} href="/training/events" />
        {communities.loading && !communities.data ? (
          <Skeleton active />
        ) : mine.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">You haven&apos;t joined any communities yet.</p>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-slate-100">
            {mine.map((c) => (
              <li key={c.id}>
                <Link href={`/training/communities/${c.slug}`} className="group flex items-center gap-3 py-2.5">
                  <div className="w-20 aspect-[16/9] rounded-xl overflow-hidden shrink-0 bg-slate-100">
                    <Cover src={communityCoverUrl(c)} label={c.name} className="text-base" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 leading-snug line-clamp-2 group-hover:underline">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.memberCount} members</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
