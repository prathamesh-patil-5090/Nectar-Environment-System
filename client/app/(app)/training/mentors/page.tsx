"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Alert, Button, Empty, Skeleton, Tag } from "antd";
import { getEvents, getMentors } from "@/lib/api/training";
import { fmtIst, useAsync, useViewer } from "@/lib/training/hooks";
import { useTrainingData } from "@/lib/training/store";
import type { MentorProfileRecord, TrainingEvent } from "@/lib/training/types";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import Cover from "@/components/training/ui/Cover";

type Stats = { upcoming: TrainingEvent[]; hosted: number; learners: number };

/** Portrait mentor card: photo, name and role, specialties, and their next session. */
function MentorCard({ m, stats }: { m: MentorProfileRecord; stats?: Stats }) {
  const next = stats?.upcoming[0];
  return (
    <Link
      href={`/training/mentors/${encodeURIComponent(m.employeeId)}`}
      className="group flex flex-col bg-white! border border-slate-200 rounded-3xl overflow-hidden hover:border-[#1C4463] hover:shadow-lg transition-all focus-visible:outline-2 focus-visible:outline-emerald-600"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <Cover src={m.photoUrl} label={m.name} className="object-[center_20%] transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-4 pt-10 pb-3">
          <div className="text-lg font-bold text-white leading-tight">{m.name}</div>
          <div className="text-sm text-white/80 truncate">{[m.title, m.department].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        {m.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {m.specialties.slice(0, 3).map((s) => (
              <Tag key={s} className="m-0! rounded-full!">{s}</Tag>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-center">
          {([
            ["Upcoming", stats?.upcoming.length ?? 0],
            ["Hosted", stats?.hosted ?? 0],
            ["Learners", stats?.learners ?? 0],
          ] as const).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 py-1.5">
              <div className="font-extrabold text-slate-900">{value}</div>
              <div className="text-[11px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-auto text-sm">
          {next ? (
            <>
              <div className="text-xs font-semibold text-emerald-700">Next · {fmtIst(next.startsAt)}</div>
              <div className="font-semibold text-slate-900 line-clamp-2">{next.title}</div>
            </>
          ) : (
            <div className="text-slate-500">No sessions scheduled right now</div>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Mentors: the people who teach. Separate from Events, which lists the sessions themselves. */
export default function MentorsPage() {
  const viewer = useViewer();
  useTrainingData();
  const mentors = useAsync(() => getMentors(), []);
  const upcoming = useAsync(() => getEvents({ viewerId: viewer.personId, view: "upcoming" }), [viewer.personId]);
  const past = useAsync(() => getEvents({ viewerId: viewer.personId, view: "past" }), [viewer.personId]);

  const statsById = useMemo(() => {
    const map = new Map<string, Stats>();
    const get = (id: string) => map.get(id) ?? (map.set(id, { upcoming: [], hosted: 0, learners: 0 }), map.get(id)!);
    for (const e of upcoming.data ?? []) if (e.status !== "cancelled") e.hostEmployeeIds.forEach((h) => get(h).upcoming.push(e));
    for (const e of past.data ?? []) {
      if (e.status === "cancelled") continue;
      e.hostEmployeeIds.forEach((h) => {
        const s = get(h);
        s.hosted += 1;
        s.learners += e.goingCount;
      });
    }
    return map;
  }, [upcoming.data, past.data]);

  const list = mentors.data ?? [];

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <TrainingSubNav />

      <header className="rounded-3xl bg-gradient-to-br from-[#1C4463] to-[#0B1A24] p-6 sm:p-8">
        <h1 className="m-0 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Mentors</h1>
        <p className="m-0 mt-1 text-white/70 max-w-2xl">
          Plant leaders who run live masterclasses on real operating problems. Open a profile to see what they teach and when they&apos;re next on.
        </p>
      </header>

      {mentors.error ? (
        <Alert type="error" showIcon title="Couldn't load mentors" description={mentors.error} action={<Button onClick={mentors.reload}>Try again</Button>} />
      ) : mentors.loading && !mentors.data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton.Node key={i} active style={{ width: "100%", height: 380, borderRadius: 24 }} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-8">
          <Empty description="No mentors yet" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {list.map((m) => (
            <MentorCard key={m.employeeId} m={m} stats={statsById.get(m.employeeId)} />
          ))}
        </div>
      )}
    </div>
  );
}
