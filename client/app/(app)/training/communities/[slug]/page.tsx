"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { App, Avatar, Button, Empty, Pagination, Result, Skeleton, Tabs, Tag } from "antd";
import { getCommunity, getCommunityMembers, getEvents, joinCommunity, leaveCommunity } from "@/lib/api/training";
import { useAsync, useViewer } from "@/lib/training/hooks";
import { useTrainingData } from "@/lib/training/store";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import EventCard from "@/components/training/ui/EventCard";
import Shelf from "@/components/training/ui/Shelf";
import styles from "@/components/training/ui/training.module.css";

const MEMBERS_PAGE_SIZE = 24;

/** Community (Meetup "group"): about, organizers, members, upcoming and past events, join / leave. */
export default function CommunityPage() {
  const { message } = App.useApp();
  const params = useParams();
  const slug = String(Array.isArray(params?.slug) ? params.slug[0] : params?.slug ?? "");
  const viewer = useViewer();
  useTrainingData();
  const community = useAsync(() => getCommunity(slug, viewer.personId), [slug, viewer.personId]);
  const c = community.data;
  const members = useAsync(() => getCommunityMembers(slug), [slug]);
  const [memberPage, setMemberPage] = useState(1);
  const upcoming = useAsync(
    () => (c ? getEvents({ viewerId: viewer.personId, view: "upcoming", communityId: c.id }) : Promise.resolve([])),
    [c?.id, viewer.personId],
  );
  const past = useAsync(
    () => (c ? getEvents({ viewerId: viewer.personId, view: "past", communityId: c.id }) : Promise.resolve([])),
    [c?.id, viewer.personId],
  );

  if (community.loading && !c) return <Skeleton active style={{ padding: 24 }} />;
  if (!c) return <Result status="404" title="Community not found" subTitle={community.error ?? undefined} extra={<Link href="/training/events">All events</Link>} />;

  const toggle = async () => {
    if (!viewer.personId) return;
    try {
      community.setData(await (c.isMember ? leaveCommunity : joinCommunity)(slug, viewer.personId));
      void members.reload();
      message.success(c.isMember ? "You left the community" : "You joined. You'll hear about new events.");
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  return (
    <div className={styles.page}>
      <TrainingSubNav />
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div className={styles.line}><Link href="/training/events">Events</Link> / Communities</div>
          <h1 style={{ margin: "4px 0", fontSize: 26, fontWeight: 700, color: "#0B1A24" }}>{c.name}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#4A6375", flexWrap: "wrap" }}>
            {c.domain && <Tag>{c.domain}</Tag>}
            <span>{c.memberCount} members</span>
            {c.organizers.length > 0 && <span>· Organized by {c.organizers.map((o) => o.name).join(", ")}</span>}
          </div>
        </div>
        <Button type={c.isMember ? "default" : "primary"} size="large" onClick={toggle}>
          {c.isMember ? "Leave community" : "Join community"}
        </Button>
      </header>

      <Tabs
        items={[
          {
            key: "events",
            label: "Events",
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{c.description}</p>
                <Shelf title="Upcoming events" items={upcoming.data} loading={upcoming.loading} error={upcoming.error} emptyText="No upcoming events" render={(e) => <EventCard key={e.id} event={e} />} />
                <Shelf title="Past events" items={past.data} loading={past.loading} hideWhenEmpty render={(e) => <EventCard key={e.id} event={e} />} />
              </div>
            ),
          },
          {
            key: "members",
            label: `Members (${c.memberCount})`,
            children: (
              members.loading ? (
                <Skeleton active />
              ) : (members.data ?? []).length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No members yet" />
              ) : (
                <>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                    {(members.data ?? []).slice((memberPage - 1) * MEMBERS_PAGE_SIZE, memberPage * MEMBERS_PAGE_SIZE).map((p) => (
                      <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Avatar src={p.photoUrl}>{p.name[0]}</Avatar>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>
                            {p.name} {c.organizerEmployeeIds.includes(p.id) && <Tag color="purple">Organizer</Tag>}
                          </div>
                          <div className={styles.line}>{[p.designation, p.siteName].filter(Boolean).join(" · ")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Pagination
                    style={{ marginTop: 16, justifyContent: "flex-end" }}
                    current={memberPage}
                    pageSize={MEMBERS_PAGE_SIZE}
                    total={(members.data ?? []).length}
                    onChange={setMemberPage}
                    hideOnSinglePage
                  />
                </>
              )
            ),
          },
        ]}
      />
    </div>
  );
}
