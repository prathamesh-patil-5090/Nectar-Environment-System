"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, App, Button, Descriptions, Empty, Input, Result, Skeleton, Space, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DownloadOutlined } from "@ant-design/icons";
import {
  addEventPost,
  eventAttendeesCsvUrl,
  getEvent,
  getEventAttendees,
  publishEvent,
  updateAttendee,
} from "@/lib/api/training";
import { fmtTimeRange, useAsync, useViewer } from "@/lib/training/hooks";
import { getSiteName, useTrainingData } from "@/lib/training/store";
import type { EventAttendee, RsvpStatus } from "@/lib/training/types";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import EventFormModal from "@/components/training/mentor/EventFormModal";
import styles from "@/components/training/ui/training.module.css";
import { tr, trTable, intlLocale, trData } from "@/lib/i18n";

const STATUS_TAG: Record<RsvpStatus, { color: string; label: string }> = trTable({
  going: { color: "green", label: "Going" },
  waitlist: { color: "gold", label: "Waitlist" },
  cancelled: { color: "default", label: "Cancelled" },
  attended: { color: "blue", label: "Attended" },
  no_show: { color: "red", label: "No-show" },
});

/** Host view of one event: attendees + answers, waitlist moves, attendance, announcement, CSV. */
export default function ManageEventPage() {
  const { message } = App.useApp();
  const params = useParams();
  const eventId = String(Array.isArray(params?.eventId) ? params.eventId[0] : params?.eventId ?? "");
  const viewer = useViewer();
  const me = viewer.personId ?? "";
  useTrainingData();
  const ev = useAsync(() => getEvent(eventId, me), [eventId, me]);
  const attendees = useAsync(() => getEventAttendees(eventId, me), [eventId, me]);
  const [announce, setAnnounce] = useState("");
  const [sending, setSending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [now] = useState(() => Date.now());

  if (ev.loading && !ev.data) return <Skeleton active style={{ padding: 24 }} />;
  const event = ev.data;
  if (!event) return <Result status="404" title={tr("Event not found")} extra={<Link href="/training/mentor">{tr("Mentor Studio")}</Link>} />;
  if (!event.isHost) return <Result status="403" title={tr("Only the hosts can manage this event")} extra={<Link href={`/training/events/${event.id}`}>{tr("View event")}</Link>} />;

  const started = Date.parse(event.startsAt) <= now;
  const rows = attendees.data ?? [];
  const by = (s: RsvpStatus[]) => rows.filter((r) => r.status && s.includes(r.status));

  const setStatus = async (r: EventAttendee, status: RsvpStatus, ok: string) => {
    try {
      attendees.setData(await updateAttendee(event.id, r.id!, status, me));
      void ev.reload();
      message.success(ok);
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const columns: ColumnsType<EventAttendee> = [
    {
      title: tr("Name"),
      key: "name",
      render: (_, r) => (
        <div>
          <Link href={`/employees/${r.employee.id}`} style={{ fontWeight: 600 }}>{trData(r.employee.name)}</Link>
          <div className={styles.line}>{[r.employee.designation, r.employee.siteName].filter(Boolean).map((x) => trData(String(x))).join(" · ")}</div>
        </div>
      ),
    },
    { title: tr("Answer"), dataIndex: "answer", render: (a?: string) => trData(a) || <span style={{ color: "#94A3B8" }}>—</span> },
    {
      title: tr("Registered"),
      dataIndex: "rsvpAt",
      render: (d?: string) => (d ? new Date(d).toLocaleString(intlLocale(), { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : ""),
    },
    { title: tr("Status"), dataIndex: "status", render: (s: RsvpStatus) => <Tag color={STATUS_TAG[s].color}>{STATUS_TAG[s].label}</Tag> },
    {
      title: "",
      key: "act",
      align: "right",
      render: (_, r) => (
        <Space wrap>
          {r.status === "waitlist" && <Button size="small" onClick={() => setStatus(r, "going", `${r.employee.name} is now going`)}>{tr("Move to going")}</Button>}
          {(r.status === "going" || r.status === "waitlist") && !started && (
            <Button size="small" danger onClick={() => setStatus(r, "cancelled", "Removed")}>{tr("Remove")}</Button>
          )}
          {started && (r.status === "going" || r.status === "no_show") && <Button size="small" onClick={() => setStatus(r, "attended", "Marked attended")}>{tr("Attended")}</Button>}
          {started && (r.status === "going" || r.status === "attended") && <Button size="small" onClick={() => setStatus(r, "no_show", "Marked no-show")}>{tr("No-show")}</Button>}
        </Space>
      ),
    },
  ];

  const table = (list: EventAttendee[], empty: string) => (
    <Table<EventAttendee> rowKey={(r) => r.id ?? r.employee.id} size="middle" columns={columns} dataSource={list} loading={attendees.loading} scroll={{ x: 800 }} pagination={{ pageSize: 20, hideOnSinglePage: true }} locale={{ emptyText: <Empty description={trData(empty)} /> }} />
  );

  return (
    <div className={styles.page}>
      <TrainingSubNav />
      <div className={styles.line}><Link href="/training/mentor">{tr("Mentor Studio")}</Link> / {tr("Manage")}</div>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0B1A24" }}>{trData(event.title)}</h1>
        <Space wrap>
          <Link href={`/training/events/${event.id}`}><Button>{tr("View event page")}</Button></Link>
          {(event.status === "draft" || event.status === "published") && <Button onClick={() => setEditOpen(true)}>{tr("Edit")}</Button>}
          {event.status === "draft" && (
            <Button
              type="primary"
              onClick={async () => {
                try {
                  ev.setData(await publishEvent(event.id, me));
                  message.success(tr("Published. Community members were notified."));
                } catch (err) {
                  message.error((err as Error).message);
                }
              }}
            >
              {tr("Publish")}
            </Button>
          )}
          <Button icon={<DownloadOutlined />} href={eventAttendeesCsvUrl(event.id, me)}>CSV</Button>
        </Space>
      </header>

      {event.status === "cancelled" && <Alert type="error" showIcon title={tr("Cancelled")} description={trData(event.cancelReason)} />}

      <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label={tr("When")}>{fmtTimeRange(event.startsAt, event.endsAt)}</Descriptions.Item>
        <Descriptions.Item label={tr("Where")}>
          {event.format === "online" ? (event.meetLink ? <a href={event.meetLink} target="_blank" rel="noreferrer">{event.meetLink}</a> : tr("Online · link not added yet")) : [getSiteName(event.venue?.siteId), event.venue?.room].filter(Boolean).join(" · ")}
        </Descriptions.Item>
        <Descriptions.Item label={tr("Seats")}>{tr("{going}/{capacity} going", { going: event.goingCount, capacity: event.capacity })}{event.waitlistCount ? tr(" · {waitlistCount} on waitlist", { waitlistCount: event.waitlistCount }) : ""}</Descriptions.Item>
        <Descriptions.Item label={tr("Status")}><Tag>{tr(event.status)}</Tag></Descriptions.Item>
      </Descriptions>

      {event.status === "published" && (
        <section className={styles.panel}>
          <h2 className={styles.shelfTitle} style={{ fontSize: 16, marginBottom: 8 }}>{tr("Message everyone going")}</h2>
          <Input.TextArea rows={2} maxLength={500} showCount value={announce} onChange={(e) => setAnnounce(e.target.value)} placeholder={tr("e.g. Please bring last week's SVI readings.")} aria-label={tr("Announcement")} />
          <Button
            type="primary"
            style={{ marginTop: 8 }}
            loading={sending}
            disabled={!announce.trim()}
            onClick={async () => {
              setSending(true);
              try {
                await addEventPost(event.id, me, announce.trim(), "announcement");
                setAnnounce("");
                message.success(tr("Sent. It's pinned in the discussion too."));
              } catch (err) {
                message.error((err as Error).message);
              } finally {
                setSending(false);
              }
            }}
          >
            {tr("Send announcement")}
          </Button>
        </section>
      )}

      {attendees.error ? (
        <Alert type="error" title={trData(attendees.error)} />
      ) : (
        <Tabs
          items={[
            { key: "going", label: tr("Going ({itemCount})", { itemCount: by(["going"]).length }), children: table(by(["going"]), tr("Nobody yet")) },
            { key: "waitlist", label: tr("Waitlist ({itemCount})", { itemCount: by(["waitlist"]).length }), children: table(by(["waitlist"]), tr("No waitlist")) },
            ...(started ? [{ key: "attendance", label: tr("Attendance ({itemCount} attended)", { itemCount: by(["attended"]).length }), children: table(by(["going", "attended", "no_show"]), tr("Nobody registered")) }] : []),
            { key: "cancelled", label: tr("Cancelled ({itemCount})", { itemCount: by(["cancelled"]).length }), children: table(by(["cancelled"]), tr("No cancellations")) },
          ]}
        />
      )}

      <EventFormModal open={editOpen} event={event} onClose={() => setEditOpen(false)} onSaved={() => void ev.reload()} />
    </div>
  );
}
