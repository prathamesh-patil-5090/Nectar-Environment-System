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

const STATUS_TAG: Record<RsvpStatus, { color: string; label: string }> = {
  going: { color: "green", label: "Going" },
  waitlist: { color: "gold", label: "Waitlist" },
  cancelled: { color: "default", label: "Cancelled" },
  attended: { color: "blue", label: "Attended" },
  no_show: { color: "red", label: "No-show" },
};

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
  if (!event) return <Result status="404" title="Event not found" extra={<Link href="/training/mentor">Mentor Studio</Link>} />;
  if (!event.isHost) return <Result status="403" title="Only the hosts can manage this event" extra={<Link href={`/training/events/${event.id}`}>View event</Link>} />;

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
      title: "Name",
      key: "name",
      render: (_, r) => (
        <div>
          <Link href={`/employees/${r.employee.id}`} style={{ fontWeight: 600 }}>{r.employee.name}</Link>
          <div className={styles.line}>{[r.employee.designation, r.employee.siteName].filter(Boolean).join(" · ")}</div>
        </div>
      ),
    },
    { title: "Answer", dataIndex: "answer", render: (a?: string) => a || <span style={{ color: "#94A3B8" }}>—</span> },
    {
      title: "Registered",
      dataIndex: "rsvpAt",
      render: (d?: string) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : ""),
    },
    { title: "Status", dataIndex: "status", render: (s: RsvpStatus) => <Tag color={STATUS_TAG[s].color}>{STATUS_TAG[s].label}</Tag> },
    {
      title: "",
      key: "act",
      align: "right",
      render: (_, r) => (
        <Space wrap>
          {r.status === "waitlist" && <Button size="small" onClick={() => setStatus(r, "going", `${r.employee.name} is now going`)}>Move to going</Button>}
          {(r.status === "going" || r.status === "waitlist") && !started && (
            <Button size="small" danger onClick={() => setStatus(r, "cancelled", "Removed")}>Remove</Button>
          )}
          {started && (r.status === "going" || r.status === "no_show") && <Button size="small" onClick={() => setStatus(r, "attended", "Marked attended")}>Attended</Button>}
          {started && (r.status === "going" || r.status === "attended") && <Button size="small" onClick={() => setStatus(r, "no_show", "Marked no-show")}>No-show</Button>}
        </Space>
      ),
    },
  ];

  const table = (list: EventAttendee[], empty: string) => (
    <Table<EventAttendee> rowKey={(r) => r.id ?? r.employee.id} size="middle" columns={columns} dataSource={list} loading={attendees.loading} scroll={{ x: 800 }} pagination={{ pageSize: 20, hideOnSinglePage: true }} locale={{ emptyText: <Empty description={empty} /> }} />
  );

  return (
    <div className={styles.page}>
      <TrainingSubNav />
      <div className={styles.line}><Link href="/training/mentor">Mentor Studio</Link> / Manage</div>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0B1A24" }}>{event.title}</h1>
        <Space wrap>
          <Link href={`/training/events/${event.id}`}><Button>View event page</Button></Link>
          {(event.status === "draft" || event.status === "published") && <Button onClick={() => setEditOpen(true)}>Edit</Button>}
          {event.status === "draft" && (
            <Button
              type="primary"
              onClick={async () => {
                try {
                  ev.setData(await publishEvent(event.id, me));
                  message.success("Published. Community members were notified.");
                } catch (err) {
                  message.error((err as Error).message);
                }
              }}
            >
              Publish
            </Button>
          )}
          <Button icon={<DownloadOutlined />} href={eventAttendeesCsvUrl(event.id, me)}>CSV</Button>
        </Space>
      </header>

      {event.status === "cancelled" && <Alert type="error" showIcon title="Cancelled" description={event.cancelReason} />}

      <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label="When">{fmtTimeRange(event.startsAt, event.endsAt)}</Descriptions.Item>
        <Descriptions.Item label="Where">
          {event.format === "online" ? (event.meetLink ? <a href={event.meetLink} target="_blank" rel="noreferrer">{event.meetLink}</a> : "Online · link not added yet") : [getSiteName(event.venue?.siteId), event.venue?.room].filter(Boolean).join(" · ")}
        </Descriptions.Item>
        <Descriptions.Item label="Seats">{event.goingCount}/{event.capacity} going{event.waitlistCount ? ` · ${event.waitlistCount} on waitlist` : ""}</Descriptions.Item>
        <Descriptions.Item label="Status"><Tag>{event.status}</Tag></Descriptions.Item>
      </Descriptions>

      {event.status === "published" && (
        <section className={styles.panel}>
          <h2 className={styles.shelfTitle} style={{ fontSize: 16, marginBottom: 8 }}>Message everyone going</h2>
          <Input.TextArea rows={2} maxLength={500} showCount value={announce} onChange={(e) => setAnnounce(e.target.value)} placeholder="e.g. Please bring last week's SVI readings." aria-label="Announcement" />
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
                message.success("Sent. It's pinned in the discussion too.");
              } catch (err) {
                message.error((err as Error).message);
              } finally {
                setSending(false);
              }
            }}
          >
            Send announcement
          </Button>
        </section>
      )}

      {attendees.error ? (
        <Alert type="error" title={attendees.error} />
      ) : (
        <Tabs
          items={[
            { key: "going", label: `Going (${by(["going"]).length})`, children: table(by(["going"]), "Nobody yet") },
            { key: "waitlist", label: `Waitlist (${by(["waitlist"]).length})`, children: table(by(["waitlist"]), "No waitlist") },
            ...(started ? [{ key: "attendance", label: `Attendance (${by(["attended"]).length} attended)`, children: table(by(["going", "attended", "no_show"]), "Nobody registered") }] : []),
            { key: "cancelled", label: `Cancelled (${by(["cancelled"]).length})`, children: table(by(["cancelled"]), "No cancellations") },
          ]}
        />
      )}

      <EventFormModal open={editOpen} event={event} onClose={() => setEditOpen(false)} onSaved={() => void ev.reload()} />
    </div>
  );
}
