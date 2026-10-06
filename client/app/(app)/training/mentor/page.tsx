"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { App, Button, Dropdown, Empty, Input, Modal, Result, Skeleton, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { MoreOutlined } from "@ant-design/icons";
import { cancelEvent, duplicateEvent, getEvents, publishEvent } from "@/lib/api/training";
import { fmtTimeRange, useAsync, useIsMentor, useViewer } from "@/lib/training/hooks";
import type { TrainingEvent } from "@/lib/training/types";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import EventFormModal from "@/components/training/mentor/EventFormModal";
import { EVENT_TYPE_LABEL } from "@/components/training/ui/EventCard";
import styles from "@/components/training/ui/training.module.css";
import { tr, trData } from "@/lib/i18n";

/** Mentor Studio: the mentor's own events (Meetup organizer tools). */
export default function MentorStudioPage() {
  const { message } = App.useApp();
  const viewer = useViewer();
  const isMentor = useIsMentor(viewer.personId);
  const router = useRouter();
  const params = useSearchParams();
  const events = useAsync(() => getEvents({ viewerId: viewer.personId, view: "hosting" }), [viewer.personId]);
  const [formOpen, setFormOpen] = useState(() => params?.get("new") === "1");
  const [editing, setEditing] = useState<TrainingEvent | null>(null);
  const [cancelling, setCancelling] = useState<TrainingEvent | null>(null);
  const [reason, setReason] = useState("");

  const groups = useMemo(() => {
    const now = new Date().toISOString();
    const all = events.data ?? [];
    return {
      drafts: all.filter((e) => e.status === "draft"),
      upcoming: all.filter((e) => e.status !== "draft" && e.endsAt >= now && e.status !== "completed"),
      past: all.filter((e) => e.status !== "draft" && (e.endsAt < now || e.status === "completed")).reverse(),
    };
  }, [events.data]);

  if (!viewer.personId) return <Result status="info" title={tr("Mentor Studio needs a profile on your login")} />;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
      void events.reload();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const columns: ColumnsType<TrainingEvent> = [
    {
      title: tr("Event"),
      key: "title",
      render: (_, e) => (
        <div>
          <Link href={`/training/mentor/events/${e.id}`} style={{ fontWeight: 600 }}>{trData(e.title)}</Link>
          <div className={styles.line}>
            {EVENT_TYPE_LABEL[e.type]} · {e.format === "online" ? tr("Online") : tr("At a plant")}
            {e.seriesId ? tr(" · Series") : ""}
          </div>
        </div>
      ),
    },
    { title: tr("When"), key: "when", render: (_, e) => fmtTimeRange(e.startsAt, e.endsAt) },
    {
      title: tr("Seats"),
      key: "seats",
      render: (_, e) => `${e.goingCount}/${e.capacity}${e.waitlistCount ? tr(" · {waitlistCount} waiting", { waitlistCount: e.waitlistCount }) : ""}`,
    },
    {
      title: tr("Status"),
      dataIndex: "status",
      render: (s: TrainingEvent["status"]) => <Tag color={s === "published" ? "green" : s === "cancelled" ? "red" : s === "draft" ? "default" : "blue"}>{s}</Tag>,
    },
    {
      title: "",
      key: "act",
      align: "right",
      render: (_, e) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "manage", label: tr("Manage attendees"), onClick: () => router.push(`/training/mentor/events/${e.id}`) },
              { key: "view", label: tr("View event page"), onClick: () => router.push(`/training/events/${e.id}`) },
              ...(e.status === "draft" || e.status === "published" ? [{ key: "edit", label: tr("Edit"), onClick: () => { setEditing(e); setFormOpen(true); } }] : []),
              ...(e.status === "draft" ? [{ key: "publish", label: tr("Publish"), onClick: () => act(() => publishEvent(e.id, viewer.personId!), tr("Published. Community members were notified.")) }] : []),
              { key: "dup", label: tr("Duplicate as draft"), onClick: () => act(() => duplicateEvent(e.id, viewer.personId!), tr("Copied as a new draft")) },
              ...(e.status === "draft" || e.status === "published" ? [{ key: "cancel", danger: true, label: tr("Cancel event"), onClick: () => { setReason(""); setCancelling(e); } }] : []),
            ],
          }}
        >
          <Button icon={<MoreOutlined />} aria-label={tr("Actions")} />
        </Dropdown>
      ),
    },
  ];

  const table = (list: TrainingEvent[], empty: string) => (
    <Table<TrainingEvent>
      rowKey="id"
      columns={columns}
      dataSource={list}
      loading={events.loading}
      scroll={{ x: 800 }}
      pagination={{ pageSize: 10, hideOnSinglePage: true }}
      locale={{ emptyText: <Empty description={trData(empty)} /> }}
    />
  );

  return (
    <div className={styles.page}>
      <TrainingSubNav />
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0B1A24" }}>{tr("Mentor Studio")}</h1>
          <p style={{ margin: "4px 0 0", color: "#4A6375" }}>
            {tr("Create sessions and seminars, manage seats and the waitlist, and see who's coming. You get a notification for every registration.")}
          </p>
        </div>
        {isMentor && <Button type="primary" size="large" onClick={() => { setEditing(null); setFormOpen(true); }}>{tr("Create event")}</Button>}
      </header>

      {!isMentor && !events.loading && (events.data ?? []).length === 0 ? (
        <Result status="info" title={tr("You're not a mentor")} subTitle={tr("HR or the Director can add you as a mentor.")} />
      ) : events.loading && !events.data ? (
        <Skeleton active />
      ) : (
        <Tabs
          defaultActiveKey="upcoming"
          items={[
            { key: "upcoming", label: tr("Upcoming ({upcomingCount})", { upcomingCount: groups.upcoming.length }), children: table(groups.upcoming, tr("No upcoming events")) },
            { key: "drafts", label: tr("Drafts ({draftCount})", { draftCount: groups.drafts.length }), children: table(groups.drafts, tr("No drafts")) },
            { key: "past", label: tr("Past ({pastCount})", { pastCount: groups.past.length }), children: table(groups.past, tr("No past events")) },
          ]}
        />
      )}

      <EventFormModal open={formOpen} event={editing} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={() => void events.reload()} />

      <Modal
        open={Boolean(cancelling)}
        title={tr("Cancel “{title}”?", { title: cancelling?.title ?? "" })}
        okText={tr("Cancel event")}
        okButtonProps={{ danger: true, disabled: !reason.trim() }}
        cancelText={tr("Keep it")}
        onCancel={() => setCancelling(null)}
        onOk={() =>
          cancelling &&
          act(() => cancelEvent(cancelling.id, reason.trim(), viewer.personId!), tr("Event cancelled. Everyone registered was told.")).then(() => setCancelling(null))
        }
      >
        <p>{tr("Everyone going or on the waitlist gets a notification with your reason.")}</p>
        <Input.TextArea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("Reason")} aria-label={tr("Reason")} />
      </Modal>
    </div>
  );
}
