"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { App, Avatar, Button, Empty, Input, Pagination, Popconfirm, Result, Segmented, Skeleton, Tag } from "antd";
import {
  CheckOutlined,
  CrownOutlined,
  EnvironmentOutlined,
  RightOutlined,
  SearchOutlined,
  ShareAltOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { getCommunity, getCommunityMembers, getEvents, joinCommunity, leaveCommunity } from "@/lib/api/training";
import { useAsync, useViewer } from "@/lib/training/hooks";
import { useTrainingData } from "@/lib/training/store";
import type { Community, Person, TrainingEvent } from "@/lib/training/types";
import { EventImageCard, communityCoverUrl } from "@/components/training/ui/EventCard";
import { tr, trData } from "@/lib/i18n";

const MEMBERS_PAGE_SIZE = 24;
type TabKey = "about" | "events" | "members";

const card = "bg-white border border-slate-200 rounded-3xl p-5";

function Cover({ c }: { c: Community }) {
  const src = communityCoverUrl(c);
  return (
    <div className="relative w-full aspect-[16/9] rounded-3xl overflow-hidden bg-slate-900 border border-slate-200">
      {src ? (
        <>
          {/* Blurred fill so the whole image stays visible */}
          <img src={src} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60" />
          <img src={src} alt={trData(c.name)} className="relative w-full h-full object-contain" />
        </>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-emerald-700 to-slate-800 text-white text-5xl font-extrabold flex items-center justify-center">
          {c.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
        </div>
      )}
    </div>
  );
}

function PersonRow({ p, organizer }: { p: Person; organizer?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar size={40} src={p.photoUrl} className="bg-emerald-700 shrink-0">{p.name[0]}</Avatar>
      <div className="min-w-0">
        <div className="font-semibold text-slate-900 truncate">
          {trData(p.name)} {organizer && <Tag color="purple" className="ml-1 text-[10px]">{tr("Organizer")}</Tag>}
        </div>
        <div className="text-xs text-slate-500 truncate">{[p.designation, p.siteName].filter(Boolean).map((x) => trData(String(x))).join(" · ")}</div>
      </div>
    </div>
  );
}

function EventGrid({ items, loading, empty }: { items?: TrainingEvent[]; loading: boolean; empty: string }) {
  if (loading && !items) return <Skeleton active />;
  if (!items?.length) return <div className={card}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={trData(empty)} /></div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-7">
      {items.map((e) => <EventImageCard key={e.id} event={e} />)}
    </div>
  );
}

function SectionHead({ title, count, onSeeAll }: { title: string; count?: number; onSeeAll?: () => void }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="m-0 text-xl font-bold text-slate-900">
        {trData(title)} {count !== undefined && <span className="font-normal text-slate-500 text-base ml-1">{count}</span>}
      </h2>
      {onSeeAll && (
        <button type="button" onClick={onSeeAll} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer">
          {tr("See all")}
        </button>
      )}
    </div>
  );
}

/** Community (Meetup "group"): hero, tab bar with Join, About / Events / Members. */
export default function CommunityPage() {
  const { message } = App.useApp();
  const params = useParams();
  const slug = String(Array.isArray(params?.slug) ? params.slug[0] : params?.slug ?? "");
  const viewer = useViewer();
  useTrainingData();
  const community = useAsync(() => getCommunity(slug, viewer.personId), [slug, viewer.personId]);
  const c = community.data;
  const members = useAsync(() => getCommunityMembers(slug), [slug]);
  const upcoming = useAsync(
    () => (c ? getEvents({ viewerId: viewer.personId, view: "upcoming", communityId: c.id }) : Promise.resolve([])),
    [c?.id, viewer.personId],
  );
  const past = useAsync(
    () => (c ? getEvents({ viewerId: viewer.personId, view: "past", communityId: c.id }) : Promise.resolve([])),
    [c?.id, viewer.personId],
  );

  const [tab, setTab] = useState<TabKey>("about");
  const [eventsView, setEventsView] = useState<"upcoming" | "past">("upcoming");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [memberPage, setMemberPage] = useState(1);
  const [memberQuery, setMemberQuery] = useState("");

  // Real data only: topics come from this community's events, sites from its members
  const domain = c?.domain;
  const topics = useMemo(() => {
    const set = new Set<string>();
    if (domain) set.add(domain);
    [...(upcoming.data ?? []), ...(past.data ?? [])].forEach((e) => e.topics.forEach((t) => set.add(t)));
    return [...set].slice(0, 12);
  }, [domain, upcoming.data, past.data]);
  const sites = useMemo(
    () => [...new Set((members.data ?? []).map((m) => m.siteName).filter(Boolean))] as string[],
    [members.data],
  );
  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const list = members.data ?? [];
    return q ? list.filter((m) => `${m.name} ${m.designation ?? ""} ${m.siteName ?? ""}`.toLowerCase().includes(q)) : list;
  }, [members.data, memberQuery]);

  if (community.loading && !c) return <div className="max-w-7xl mx-auto p-6"><Skeleton active /></div>;
  if (!c) return <Result status="404" title={tr("Community not found")} subTitle={community.error ?? undefined} extra={<Link href="/training/events">{tr("All events")}</Link>} />;

  const toggle = async () => {
    if (!viewer.personId) return;
    try {
      community.setData(await (c.isMember ? leaveCommunity : joinCommunity)(slug, viewer.personId));
      void members.reload();
      message.success(c.isMember ? tr("You left the community") : tr("You joined. You'll hear about new events."));
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      message.success(tr("Community link copied"));
    } catch {
      message.error(tr("Couldn't copy the link"));
    }
  };

  const joinButton = c.everyone ? (
    <span title={tr("Everyone at Nectar Enviro is a member of this community")} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#1C4463] text-white font-semibold">
      <CheckOutlined />{" "}{tr("Everyone's a member")}
    </span>
  ) : c.isMember ? (
    <Popconfirm title={tr("Leave this community?")} description={tr("You'll stop hearing about its new events.")} okText={tr("Leave")} okButtonProps={{ danger: true }} onConfirm={toggle}>
      <Button size="large" icon={<CheckOutlined />} className="rounded-xl! font-semibold">{tr("Joined")}</Button>
    </Popconfirm>
  ) : (
    <Button type="primary" size="large" onClick={toggle} className="rounded-xl! font-semibold">{tr("Join this community")}</Button>
  );

  const organizerIds = new Set(c.organizerEmployeeIds);
  const firstOrganizer = c.organizers[0];
  const goTo = (t: TabKey) => {
    setTab(t);
    document.getElementById("community-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-10">
      {/* HERO: cover left, identity right */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <nav className="text-xs font-medium text-slate-500 mb-4">
          <Link href="/training" className="hover:text-emerald-700">{tr("Training Hub")}</Link>
          <span className="mx-2">/</span>
          <Link href="/training/events" className="hover:text-emerald-700">{tr("Events")}</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700">{trData(c.name)}</span>
        </nav>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7"><Cover c={c} /></div>
          <div className="lg:col-span-5 flex flex-col gap-4">
            <h1 className="m-0 text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">{trData(c.name)}</h1>
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5 text-slate-600">
              {sites.length > 0 && (
                <li className="flex items-center gap-2.5">
                  <EnvironmentOutlined className="text-slate-400" />
                  <span>{sites.length === 1 ? sites[0] : `${sites.slice(0, 2).join(", ")}${sites.length > 2 ? tr(" +{value} sites", { value: sites.length - 2 }) : ""}`}</span>
                </li>
              )}
              <li className="flex items-center gap-2.5">
                <TeamOutlined className="text-slate-400" />
                <button type="button" onClick={() => goTo("members")} className="hover:underline cursor-pointer">
                  {tr("{memberCount} members", { memberCount: c.memberCount })}
                </button>
                <span>·</span>
                <span>{tr("Internal community")}</span>
              </li>
              {firstOrganizer && (
                <li className="flex items-center gap-2.5">
                  <CrownOutlined className="text-slate-400" />
                  <span>
                    {tr("Organized by")}{" "}<span className="font-semibold text-slate-900">{trData(firstOrganizer.name)}</span>
                    {c.organizers.length > 1 && (c.organizers.length > 2 ? tr(" and {count} others", { count: c.organizers.length - 1 }) : tr(" and 1 other"))}
                  </span>
                </li>
              )}
            </ul>
            {c.domain && <div><Tag color="green" className="rounded-full px-3">{trData(c.domain)}</Tag></div>}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm text-slate-500 mr-1">{tr("Share:")}</span>
              <Button shape="circle" icon={<ShareAltOutlined />} onClick={share} aria-label={tr("Copy community link")} />
            </div>
          </div>
        </div>
      </div>

      {/* STICKY TAB BAR with Join on the right */}
      <div id="community-tabs" className="sticky top-0 z-20 mt-8 bg-white/95 backdrop-blur border-y border-slate-200 scroll-mt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <nav role="tablist" className="flex gap-6 overflow-x-auto">
            {([
              ["about", tr("About")],
              ["events", tr("Events")],
              ["members", tr("Members")],
            ] as [TabKey, string][]).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                type="button"
                onClick={() => setTab(key)}
                className={`py-4 text-sm font-semibold border-b-2 cursor-pointer whitespace-nowrap transition-colors ${
                  tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {trData(label)}
              </button>
            ))}
          </nav>
          <div className="py-2 shrink-0">{joinButton}</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {tab === "about" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <main className="lg:col-span-8 flex flex-col gap-10 min-w-0">
              <section className="flex flex-col gap-3">
                <h2 className="m-0 text-xl font-bold text-slate-900">{tr("What we're about")}</h2>
                <p className={`m-0 text-slate-700 leading-relaxed whitespace-pre-wrap ${aboutOpen ? "" : "line-clamp-5"}`}>
                  {c.description || tr("No description yet.")}
                </p>
                {(c.description?.length ?? 0) > 300 && (
                  <button type="button" onClick={() => setAboutOpen((v) => !v)} className="self-start text-sm font-semibold text-emerald-700 cursor-pointer">
                    {aboutOpen ? tr("Show less") : tr("Read more")}
                  </button>
                )}
              </section>

              <section className="flex flex-col gap-4">
                <SectionHead title={tr("Upcoming events")} count={upcoming.data?.length} onSeeAll={(upcoming.data?.length ?? 0) > 3 ? () => { setEventsView("upcoming"); goTo("events"); } : undefined} />
                <EventGrid items={upcoming.data?.slice(0, 3)} loading={upcoming.loading} empty={tr("No upcoming events")} />
              </section>

              {(past.data?.length ?? 0) > 0 && (
                <section className="flex flex-col gap-4">
                  <SectionHead title={tr("Past events")} count={past.data?.length} onSeeAll={(past.data?.length ?? 0) > 3 ? () => { setEventsView("past"); goTo("events"); } : undefined} />
                  <EventGrid items={past.data?.slice(0, 3)} loading={past.loading} empty={tr("No past events")} />
                </section>
              )}
            </main>

            <aside className="lg:col-span-4 flex flex-col gap-4 lg:sticky lg:top-20">
              <div className={card}>
                <SectionHead title={tr("Organizers")} />
                <div className="flex flex-col gap-3 mt-3">
                  {c.organizers.length ? c.organizers.map((o) => <PersonRow key={o.id} p={o} />) : <span className="text-sm text-slate-500">{tr("No organizers listed")}</span>}
                </div>
              </div>

              <div className={card}>
                <SectionHead title={tr("Members")} count={c.memberCount} onSeeAll={() => goTo("members")} />
                {members.loading && !members.data ? (
                  <Skeleton active avatar className="mt-3" />
                ) : (
                  <div className="grid grid-cols-5 gap-3 mt-4">
                    {(members.data ?? []).slice(0, 10).map((m) => (
                      <span key={m.id} title={trData(m.name)} className="flex justify-center"><Avatar size={44} src={m.photoUrl} className="bg-emerald-700">{m.name[0]}</Avatar></span>
                    ))}
                  </div>
                )}
              </div>

              {topics.length > 0 && (
                <div className={card}>
                  <SectionHead title={tr("Related topics")} />
                  <div className="flex flex-wrap gap-2 mt-3">
                    {topics.map((t) => (
                      <Link key={t} href={`/training/events?topic=${encodeURIComponent(t)}`} className="px-3 py-1 rounded-full border border-slate-200 text-sm text-slate-700 hover:border-emerald-600 hover:text-emerald-700">
                        {trData(t)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {tab === "events" && (
          <div className="flex flex-col gap-6">
            <Segmented
              value={eventsView}
              onChange={(v) => setEventsView(v as "upcoming" | "past")}
              options={[
                { value: "upcoming", label: tr("Upcoming ({dataCount})", { dataCount: upcoming.data?.length ?? 0 }) },
                { value: "past", label: tr("Past ({dataCount})", { dataCount: past.data?.length ?? 0 }) },
              ]}
              className="self-start"
            />
            {eventsView === "upcoming" ? (
              <EventGrid items={upcoming.data} loading={upcoming.loading} empty={tr("No upcoming events")} />
            ) : (
              <EventGrid items={past.data} loading={past.loading} empty={tr("No past events")} />
            )}
          </div>
        )}

        {tab === "members" && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="m-0 text-xl font-bold text-slate-900">
                {tr("Members")}{" "}<span className="font-normal text-slate-500 text-base ml-1">{c.memberCount}</span>
              </h2>
              <Input
                allowClear
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder={tr("Search by name, role or site")}
                value={memberQuery}
                onChange={(e) => { setMemberQuery(e.target.value); setMemberPage(1); }}
                className="max-w-xs rounded-xl!"
              />
            </div>
            {members.loading && !members.data ? (
              <Skeleton active />
            ) : filteredMembers.length === 0 ? (
              <div className={card}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={memberQuery ? tr("No members match") : tr("No members yet")} /></div>
            ) : (
              <>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredMembers.slice((memberPage - 1) * MEMBERS_PAGE_SIZE, memberPage * MEMBERS_PAGE_SIZE).map((p) => (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-3">
                      <PersonRow p={p} organizer={organizerIds.has(p.id)} />
                    </div>
                  ))}
                </div>
                <Pagination
                  className="justify-end"
                  current={memberPage}
                  pageSize={MEMBERS_PAGE_SIZE}
                  total={filteredMembers.length}
                  onChange={setMemberPage}
                  hideOnSinglePage
                />
              </>
            )}
          </div>
        )}

        {tab !== "about" && (
          <button type="button" onClick={() => setTab("about")} className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 cursor-pointer">
            {tr("Back to About")}{" "}<RightOutlined className="text-xs" />
          </button>
        )}
      </div>
    </div>
  );
}
