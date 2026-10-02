"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Alert, App, Avatar, Button, Dropdown, Empty, Input, Listy, Modal, Popconfirm, Result, Segmented, Skeleton, Tag } from "antd";
import {
  CalendarOutlined,
  CopyOutlined,
  DownOutlined,
  EnvironmentOutlined,
  PushpinFilled,
  TeamOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import {
  addEventPost,
  cancelRsvp,
  eventCalendarUrl,
  getEvent,
  getEventAttendees,
  getEventPosts,
  getSimilarEvents,
  pinEventPost,
  rsvpEvent,
} from "@/lib/api/training";
import { fmtTimeRange, useAsync, useViewer } from "@/lib/training/hooks";
import { getSiteName, useTrainingData } from "@/lib/training/store";
import type { EventPost, TrainingEvent } from "@/lib/training/types";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import EventCard, { EVENT_TYPE_LABEL, spotsText } from "@/components/training/ui/EventCard";
import styles from "@/components/training/ui/training.module.css";

const ROLE_LABEL: Record<string, string> = {
  employee: "Plant Operators",
  shift_incharge: "Shift In-Charges",
  supervisor: "Site Managers",
  safety_incharge: "Safety In-Charges",
  site_incharge: "Site In-Charges",
  manager: "Plant Managers",
  hr: "HR",
};

type Phase = "draft" | "cancelled" | "ended" | "live" | "closed" | "notOpen" | "open";

function phaseOf(ev: TrainingEvent, now: number): Phase {
  if (ev.status === "draft") return "draft";
  if (ev.status === "cancelled") return "cancelled";
  const start = Date.parse(ev.startsAt);
  const end = Date.parse(ev.endsAt);
  if (ev.status === "completed" || now >= end) return "ended";
  if (now >= start - 10 * 60_000) return "live";
  if (ev.rsvpClosesAt && now > Date.parse(ev.rsvpClosesAt)) return "closed";
  if (ev.rsvpOpensAt && now < Date.parse(ev.rsvpOpensAt)) return "notOpen";
  return "open";
}

/** Meetup-style event page. */
export default function EventPage() {
  const { message, modal } = App.useApp();
  const params = useParams();
  const router = useRouter();
  const eventId = String(Array.isArray(params?.eventId) ? params.eventId[0] : params?.eventId ?? "");
  const viewer = useViewer();
  const me = viewer.personId ?? "";
  useTrainingData();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ev = useAsync(() => getEvent(eventId, me), [eventId, me]);
  const event = ev.data;
  const registered = Boolean(event && (event.isHost || ["going", "waitlist", "attended"].includes(event.myRsvp?.status ?? "")));
  const attendees = useAsync(
    () => (registered ? getEventAttendees(eventId, me) : Promise.resolve(null)),
    [eventId, me, registered, event?.goingCount],
  );
  const posts = useAsync(() => getEventPosts(eventId), [eventId]);
  const similar = useAsync(() => getSimilarEvents(eventId, me), [eventId, me]);

  const [busy, setBusy] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [postText, setPostText] = useState("");
  const [postKind, setPostKind] = useState<EventPost["kind"]>("question");
  const [posting, setPosting] = useState(false);

  if (ev.loading && !event) return <Skeleton active style={{ padding: 24 }} />;
  if (ev.error || !event) {
    return <Result status="404" title="Event not found" subTitle={ev.error ?? undefined} extra={<Link href="/training/events">All events</Link>} />;
  }

  const phase = phaseOf(event, now);
  const rsvp = event.myRsvp?.status;
  const going = rsvp === "going" || rsvp === "attended";
  const canPost = event.isHost || going;
  const venue = event.format === "online" ? "Online · Google Meet" : [getSiteName(event.venue?.siteId) ?? "At the plant", event.venue?.room].filter(Boolean).join(" · ");
  const outsideAudience =
    (event.audience.roles?.length ?? 0) > 0 && !event.audience.roles!.includes(viewer.role);

  const doRsvp = async (ans?: string) => {
    setBusy(true);
    try {
      const updated = await rsvpEvent(event.id, me, ans);
      ev.setData(updated);
      message.success(updated.myRsvp?.status === "waitlist" ? `You're on the waitlist (#${updated.myRsvp.waitlistPosition}).` : "You're going! The host has been notified.");
      setAnswerOpen(false);
      void attendees.reload();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      ev.setData(await cancelRsvp(event.id, me));
      message.success("Your RSVP was cancelled.");
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const attend = () => (event.rsvpQuestion ? setAnswerOpen(true) : doRsvp());

  const submitPost = async () => {
    if (!postText.trim()) return;
    setPosting(true);
    try {
      posts.setData(await addEventPost(event.id, me, postText.trim(), postKind));
      setPostText("");
      message.success(postKind === "announcement" ? "Announcement sent to everyone going" : "Posted");
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setPosting(false);
    }
  };

  // ---- primary action (sticky bar) ----
  let primary: React.ReactNode;
  if (event.isHost) {
    primary = <Button type="primary" size="large" onClick={() => router.push(`/training/mentor/events/${event.id}`)}>Manage event</Button>;
  } else if (phase === "cancelled") {
    primary = <Button size="large" disabled>Cancelled</Button>;
  } else if (phase === "draft") {
    primary = <Button size="large" disabled>Not published yet</Button>;
  } else if (phase === "ended") {
    primary = <Button size="large" disabled>Event ended</Button>;
  } else if (phase === "live") {
    primary =
      going && event.format === "online" && event.meetLink ? (
        <Button type="primary" size="large" href={event.meetLink} target="_blank" icon={<VideoCameraOutlined />}>Join now</Button>
      ) : going ? (
        <Button size="large" disabled>Happening now · {venue}</Button>
      ) : (
        <Button size="large" disabled>Registration closed</Button>
      );
  } else if (rsvp === "going") {
    primary = (
      <Dropdown
        trigger={["click"]}
        menu={{
          items: [
            ...(event.rsvpQuestion ? [{ key: "answer", label: "Edit my answer", onClick: () => { setAnswer(event.myRsvp?.answer ?? ""); setAnswerOpen(true); } }] : []),
            {
              key: "cancel",
              danger: true,
              label: "Cancel RSVP",
              onClick: () =>
                modal.confirm({
                  title: "Cancel your RSVP?",
                  content: "Your seat goes to the next person on the waitlist.",
                  okText: "Cancel RSVP",
                  okButtonProps: { danger: true },
                  cancelText: "Keep my seat",
                  onOk: doCancel,
                }),
            },
          ],
        }}
      >
        <Button type="primary" size="large" loading={busy} style={{ background: "#16A34A" }}>
          Going ✓ <DownOutlined />
        </Button>
      </Dropdown>
    );
  } else if (rsvp === "waitlist") {
    primary = (
      <Popconfirm title="Leave the waitlist?" onConfirm={doCancel}>
        <Button size="large" loading={busy}>On waitlist (#{event.myRsvp?.waitlistPosition}) · Leave</Button>
      </Popconfirm>
    );
  } else if (phase === "closed") {
    primary = <Button size="large" disabled>Registration closed</Button>;
  } else if (phase === "notOpen") {
    primary = <Button size="large" disabled>Registration opens {new Date(event.rsvpOpensAt!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</Button>;
  } else if (event.spotsLeft <= 0) {
    primary = event.waitlistEnabled ? (
      <Button type="primary" size="large" loading={busy} onClick={attend}>Join waitlist</Button>
    ) : (
      <Button size="large" disabled>Full</Button>
    );
  } else {
    primary = <Button type="primary" size="large" loading={busy} onClick={attend}>Attend</Button>;
  }

  const pinned = (posts.data ?? []).filter((p) => p.pinned);
  const rest = (posts.data ?? []).filter((p) => !p.pinned);

  return (
    <div className={styles.page} style={{ paddingBottom: 0 }}>
      <TrainingSubNav />

      {/* 1. Header */}
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Tag color="#1C4463">{EVENT_TYPE_LABEL[event.type]}</Tag>
          {event.community && <Link href={`/training/communities/${event.community.slug}`}><Tag>{event.community.name}</Tag></Link>}
          {event.status === "draft" && <Tag>Draft</Tag>}
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#0B1A24" }}>{event.title}</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar.Group>
            {event.hosts.map((h) => <Avatar key={h.id} src={h.photoUrl}>{h.name[0]}</Avatar>)}
          </Avatar.Group>
          <span>
            Hosted by <strong>{event.hosts.map((h) => h.name).join(", ")}</strong>
            {event.hosts[0]?.designation ? <span style={{ color: "#4A6375" }}> · {event.hosts[0].designation}</span> : null}
          </span>
        </div>
      </header>

      {event.status === "cancelled" && <Alert type="error" showIcon title="This event was cancelled" description={event.cancelReason} />}

      <div className={styles.twoCol}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          {/* 3. Details */}
          <section className={styles.panel}>
            <h2 className={styles.shelfTitle} style={{ marginBottom: 8 }}>Details</h2>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>{event.description || "No description yet."}</p>
            {event.agenda.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, margin: "16px 0 8px" }}>Agenda</h3>
                <div>
                  {event.agenda.map((a, i) => (
                    <div key={`${a.time}-${i}`} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(5, 5, 5, 0.06)" }}>
                      <strong style={{ width: 70, flexShrink: 0 }}>{a.time}</strong> {a.item}
                    </div>
                  ))}
                </div>
              </>
            )}
            {((event.audience.roles?.length ?? 0) > 0 || (event.audience.plantTypes?.length ?? 0) > 0) && (
              <p style={{ margin: "12px 0 0", color: "#4A6375" }}>
                <strong>Who should attend:</strong>{" "}
                {[...(event.audience.roles ?? []).map((r) => ROLE_LABEL[r] ?? r), ...(event.audience.plantTypes ?? []).map((p) => `${p} plant`)].join(", ")}
              </p>
            )}
          </section>

          {/* 4. Topics */}
          {event.topics.length > 0 && (
            <section>
              <h2 className={styles.shelfTitle} style={{ fontSize: 16, marginBottom: 8 }}>Topics</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {event.topics.map((t) => (
                  <Link key={t} href={`/training/explore?skill=${encodeURIComponent(t)}`}><Tag style={{ margin: 0 }}>{t}</Tag></Link>
                ))}
              </div>
            </section>
          )}

          {/* 5. Attendees */}
          <section className={styles.panel}>
            <h2 className={styles.shelfTitle} style={{ marginBottom: 8 }}>
              <TeamOutlined /> Attendees ({event.goingCount})
            </h2>
            {!registered ? (
              <p style={{ margin: 0, color: "#4A6375" }}>Register to see who&apos;s going.</p>
            ) : attendees.loading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (attendees.data ?? []).length === 0 ? (
              <p style={{ margin: 0, color: "#4A6375" }}>Nobody has registered yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {(attendees.data ?? [])
                  .filter((a) => !a.status || a.status === "going" || a.status === "attended")
                  .map((a) => (
                    <div key={a.employee.id} style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                      <Avatar src={a.employee.photoUrl}>{a.employee.name[0]}</Avatar>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.employee.name}</div>
                        <div className={styles.line}>{[a.employee.designation, a.employee.siteName].filter(Boolean).join(" · ")}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* 6. Hosts */}
          <section>
            <h2 className={styles.shelfTitle} style={{ fontSize: 16, marginBottom: 8 }}>Hosts</h2>
            <div className={styles.grid}>
              {event.hosts.map((h) => (
                <Link key={h.id} href={`/training/events?host=${encodeURIComponent(h.id)}`} className={styles.card} style={{ padding: 14, flexDirection: "row", gap: 10, alignItems: "center" }}>
                  <Avatar size={44} src={h.photoUrl}>{h.name[0]}</Avatar>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{h.name}</div>
                    <div className={styles.line}>{h.designation}</div>
                    <div className={styles.line}>More events by this host →</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* 7. Discussion */}
          <section className={styles.panel} id="discussion">
            <h2 className={styles.shelfTitle} style={{ marginBottom: 8 }}>Discussion</h2>
            {canPost ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <Segmented
                  value={postKind}
                  onChange={(v) => setPostKind(v as EventPost["kind"])}
                  options={[
                    { value: "question", label: "Question" },
                    { value: "comment", label: "Comment" },
                    ...(event.isHost ? [{ value: "announcement", label: "Announcement (notifies everyone going)" }] : []),
                  ]}
                />
                <Input.TextArea
                  rows={2}
                  maxLength={500}
                  showCount
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder={postKind === "question" ? "Ask the host something to cover…" : "Write a message"}
                  aria-label="Discussion message"
                />
                <div><Button type="primary" loading={posting} onClick={submitPost} disabled={!postText.trim()}>Post</Button></div>
              </div>
            ) : (
              <Alert type="info" showIcon title="Attend the event to join the discussion." style={{ marginBottom: 12 }} />
            )}
            {posts.loading ? (
              <Skeleton active />
            ) : (posts.data ?? []).length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No posts yet" />
            ) : (
              <Listy
                items={[...pinned, ...rest]}
                rowKey="id"
                virtual={false}
                itemRender={(p) => (
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid rgba(5, 5, 5, 0.06)" }}>
                    <Avatar src={p.author?.photoUrl}>{p.author?.name?.[0] ?? "?"}</Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {p.pinned && <PushpinFilled style={{ color: "#C45C26", marginRight: 6 }} />}
                        {p.author?.name ?? p.authorEmployeeId}{" "}
                        {p.kind !== "comment" && <Tag color={p.kind === "announcement" ? "volcano" : "blue"}>{p.kind}</Tag>}
                        <span style={{ fontWeight: 400, color: "#4A6375", fontSize: 12 }}>
                          {new Date(p.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </div>
                      <div style={{ color: "#0B1A24", whiteSpace: "pre-wrap" }}>{p.text}</div>
                    </div>
                    {event.isHost && (
                      <Button
                        size="small"
                        type="text"
                        onClick={async () => {
                          try {
                            posts.setData(await pinEventPost(event.id, p.id, !p.pinned, me));
                          } catch (err) {
                            message.error((err as Error).message);
                          }
                        }}
                      >
                        {p.pinned ? "Unpin" : "Pin"}
                      </Button>
                    )}
                  </div>
                )}
              />
            )}
          </section>

          {/* 8. After the event */}
          {phase === "ended" && (going || event.isHost) && (
            <section className={styles.panel} id="feedback">
              <h2 className={styles.shelfTitle} style={{ marginBottom: 8 }}>After the event</h2>
              {event.recordingUrl ? (
                <p><a href={event.recordingUrl} target="_blank" rel="noreferrer">Recording / slides</a></p>
              ) : (
                <p style={{ color: "#4A6375" }}>No recording was shared.</p>
              )}
              {!event.isHost && <p style={{ margin: 0 }}>Share feedback with the host as a comment in the discussion above.</p>}
            </section>
          )}

          {/* 9. More events like this */}
          {(similar.data ?? []).length > 0 && (
            <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 className={styles.shelfTitle}>More events like this</h2>
              <div className={styles.grid}>{(similar.data ?? []).map((e) => <EventCard key={e.id} event={e} />)}</div>
            </section>
          )}
        </div>

        {/* 2. Info card */}
        <aside className={`${styles.panel} ${styles.sticky}`} aria-label="When and where">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <CalendarOutlined style={{ fontSize: 18, color: "#1C4463", marginTop: 3 }} />
              <div>
                <div style={{ fontWeight: 600 }}>{fmtTimeRange(event.startsAt, event.endsAt)}</div>
                <a href={eventCalendarUrl(event.id)}>Add to calendar</a>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {event.format === "online" ? <VideoCameraOutlined style={{ fontSize: 18, color: "#1C4463", marginTop: 3 }} /> : <EnvironmentOutlined style={{ fontSize: 18, color: "#1C4463", marginTop: 3 }} />}
              <div>
                <div style={{ fontWeight: 600 }}>{venue}</div>
                {event.format === "online" && (
                  <div className={styles.line} style={{ whiteSpace: "normal" }}>
                    {going || event.isHost ? (event.meetLink ? "The Join button opens 10 minutes before the start." : "The host hasn't added the link yet.") : "The link is shown to attendees."}
                  </div>
                )}
              </div>
            </div>
            {event.rsvpClosesAt && phase !== "ended" && (
              <div className={styles.line} style={{ whiteSpace: "normal" }}>
                Registration closes {new Date(event.rsvpClosesAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
              </div>
            )}
            <div style={{ fontWeight: 600 }}>{spotsText(event)}</div>
            {outsideAudience && <Alert type="info" title={`Intended for ${(event.audience.roles ?? []).map((r) => ROLE_LABEL[r] ?? r).join(", ")}. You can still attend.`} />}
            <Button
              icon={<CopyOutlined />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  message.success("Link copied");
                } catch {
                  message.error("Couldn't copy the link");
                }
              }}
            >
              Copy link
            </Button>
          </div>
        </aside>
      </div>

      {/* Sticky bottom bar */}
      <div className={styles.bottomBar}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.line}>{fmtTimeRange(event.startsAt, event.endsAt)}</div>
          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 520 }}>{event.title}</div>
          <div className={styles.line}>{spotsText(event)}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {going && phase !== "ended" && <a href={eventCalendarUrl(event.id)}>Add to calendar</a>}
          {primary}
        </div>
      </div>

      <Modal
        open={answerOpen}
        title={event.rsvpQuestion}
        okText={rsvp === "going" ? "Save answer" : "Attend"}
        confirmLoading={busy}
        onOk={() => doRsvp(answer)}
        onCancel={() => setAnswerOpen(false)}
        okButtonProps={{ disabled: !answer.trim() }}
      >
        <p style={{ color: "#4A6375" }}>The host asks this before you register. Only the hosts see your answer.</p>
        <Input.TextArea rows={3} maxLength={300} showCount value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your answer" />
      </Modal>
    </div>
  );
}
