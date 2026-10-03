"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar, Button, Result, Skeleton } from "antd";
import { getCommunities, getEvents, getMentor } from "@/lib/api/training";
import { useAsync, useViewer } from "@/lib/training/hooks";
import { useTrainingData } from "@/lib/training/store";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import Shelf from "@/components/training/ui/Shelf";
import Cover from "@/components/training/ui/Cover";
import { EventImageCard, communityCoverUrl } from "@/components/training/ui/EventCard";

/** Mentor profile: who they are, what they teach, their sessions and the circles they organise. */
export default function MentorProfilePage() {
  const params = useParams();
  const raw = Array.isArray(params?.employeeId) ? params.employeeId[0] : params?.employeeId;
  const employeeId = decodeURIComponent(String(raw ?? ""));
  const viewer = useViewer();
  useTrainingData();

  const mentor = useAsync(() => getMentor(employeeId), [employeeId]);
  const upcoming = useAsync(() => getEvents({ viewerId: viewer.personId, view: "upcoming", hostId: employeeId }), [employeeId, viewer.personId]);
  const past = useAsync(() => getEvents({ viewerId: viewer.personId, view: "past", hostId: employeeId }), [employeeId, viewer.personId]);
  const communities = useAsync(() => getCommunities(viewer.personId), [viewer.personId]);

  const m = mentor.data;
  if (mentor.loading && !m) return <Skeleton active style={{ padding: 24 }} />;
  if (!m) {
    return (
      <Result
        status="404"
        title="Mentor not found"
        subTitle={mentor.error ?? undefined}
        extra={<Link href="/training/mentors"><Button type="primary">All mentors</Button></Link>}
      />
    );
  }

  const live = (upcoming.data ?? []).filter((e) => e.status !== "cancelled");
  const done = (past.data ?? []).filter((e) => e.status !== "cancelled");
  const learners = done.reduce((s, e) => s + e.goingCount, 0);
  const organises = (communities.data ?? []).filter((c) => c.organizerEmployeeIds.includes(employeeId));
  const topics = [...new Set([...m.specialties, ...[...live, ...done].flatMap((e) => e.topics)])];

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <TrainingSubNav />

      <nav aria-label="Breadcrumbs" className="text-xs font-medium text-slate-500 flex gap-2">
        <Link href="/training/mentors" className="hover:text-emerald-700">Mentors</Link>
        <span>/</span>
        <span className="text-slate-700">{m.name}</span>
      </nav>

      {/* Profile header */}
      <header className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)] items-start">
        <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-slate-100 border border-slate-200">
          <Cover src={m.photoUrl} label={m.name} className="object-[center_20%]" />
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1C4463] text-white">Mentor</span>
            <h1 className="m-0 mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{m.name}</h1>
            <p className="m-0 mt-1 text-slate-600">{[m.title, m.department].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {([
              ["Upcoming", live.length],
              ["Sessions hosted", done.length],
              ["Learners taught", learners],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white border border-slate-200 px-3 py-2.5">
                <div className="text-2xl font-extrabold text-slate-900">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          {m.bio && <p className="m-0 text-slate-700 leading-relaxed whitespace-pre-wrap max-w-3xl">{m.bio}</p>}
          {topics.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Teaches</div>
              <div className="flex flex-wrap gap-2">
                {topics.map((t) => (
                  <Link key={t} href={`/training/explore?q=${encodeURIComponent(t)}`} className="px-3 py-1 rounded-full text-sm bg-white! border border-slate-200 text-slate-700! hover:border-[#1C4463] hover:text-[#1C4463]!">
                    {t}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {organises.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Organises</div>
              <div className="flex flex-wrap gap-2">
                {organises.map((c) => (
                  <Link key={c.id} href={`/training/communities/${c.slug}`} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white! border border-slate-200 hover:border-[#1C4463]">
                    <Avatar size={26} src={communityCoverUrl(c)} className="bg-emerald-700">{c.name[0]}</Avatar>
                    <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <Shelf
        title="Upcoming sessions"
        items={live}
        loading={upcoming.loading}
        error={upcoming.error}
        emptyText={`${m.name.split(" ")[0]} has no sessions scheduled right now`}
        viewAllHref={`/training/events?host=${encodeURIComponent(employeeId)}`}
        render={(e) => <EventImageCard key={e.id} event={e} />}
      />
      <Shelf
        title="Past sessions"
        items={done}
        loading={past.loading}
        hideWhenEmpty
        render={(e) => <EventImageCard key={e.id} event={e} />}
      />
    </div>
  );
}
