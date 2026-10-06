"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Dropdown,
  Input,
  Modal,
  Popconfirm,
  Result,
  Skeleton,
  Tag,
} from "antd";
import {
  BookOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  TagOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import {
  addEventPost,
  cancelRsvp,
  getEvent,
  getEventAttendees,
  getEventPosts,
  getSimilarEvents,
  pinEventPost,
  rsvpEvent,
} from "@/lib/api/training";
import { useAsync, useViewer } from "@/lib/training/hooks";
import { getSiteName, useTrainingData } from "@/lib/training/store";
import type { EventPost, TrainingEvent } from "@/lib/training/types";
import { EventImageCard } from "@/components/training/ui/EventCard";

// Modular Meetup-Grade Components
import EventHeroBanner, { EventCoverImage } from "@/components/training/events/EventHeroBanner";
import EventHighlightsBar from "@/components/training/events/EventHighlightsBar";
import EventAgendaTimeline from "@/components/training/events/EventAgendaTimeline";
import EventAttendeesSection from "@/components/training/events/EventAttendeesSection";
import EventHostCard from "@/components/training/events/EventHostCard";
import EventChatSection from "@/components/training/events/EventChatSection";
import EventLogisticsCard from "@/components/training/events/EventLogisticsCard";
import EventStickyBottomBar from "@/components/training/events/EventStickyBottomBar";
import { tr, trTable, intlLocale, trData } from "@/lib/i18n";

const ROLE_LABEL: Record<string, string> = trTable({
  employee: "Plant Operators",
  shift_incharge: "Shift In-Charges",
  supervisor: "Site Managers",
  safety_incharge: "Safety In-Charges",
  site_incharge: "Site In-Charges",
  manager: "Plant Managers",
  hr: "HR & Training Lead",
});

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

/**
 * Meetup-Grade Event Details & Interactive Learning Experience
 * Benchmarked against Meetup's top-tier AWS event page architecture.
 */
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
  const registered = Boolean(
    event && (event.isHost || ["going", "waitlist", "attended"].includes(event.myRsvp?.status ?? ""))
  );

  const attendees = useAsync(
    () => (registered ? getEventAttendees(eventId, me) : Promise.resolve(null)),
    [eventId, me, registered, event?.goingCount]
  );
  const posts = useAsync(() => getEventPosts(eventId), [eventId]);
  const similar = useAsync(() => getSimilarEvents(eventId, me), [eventId, me]);

  const [busy, setBusy] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [answer, setAnswer] = useState("");

  if (ev.loading && !event) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton.Button active style={{ width: 220, height: 24 }} />
        <Skeleton active title paragraph={{ rows: 4 }} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton.Image active style={{ width: "100%", height: 320 }} />
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
          <div className="space-y-4">
            <Skeleton.Node active style={{ width: "100%", height: 280 }} />
          </div>
        </div>
      </div>
    );
  }

  if (ev.error || !event) {
    return (
      <div className="py-16">
        <Result
          status="404"
          title={tr("Event Not Found")}
          subTitle={ev.error ?? tr("The requested event or masterclass could not be located.")}
          extra={
            <Link href="/training/events">
              <Button type="primary" className="rounded-xl font-bold bg-emerald-600">
                {tr("Browse All Events")}
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const phase = phaseOf(event, now);
  const rsvp = event.myRsvp?.status;
  const going = rsvp === "going" || rsvp === "attended";
  const canPost = event.isHost || going;
  const venue =
    event.format === "online"
      ? tr("Online · Google Meet")
      : [getSiteName(event.venue?.siteId) ?? tr("Plant Site"), event.venue?.room].filter(Boolean).map((x) => trData(String(x))).join(" · ");

  const outsideAudience =
    (event.audience.roles?.length ?? 0) > 0 && !event.audience.roles!.includes(viewer.role);

  // ---- RSVP Actions ----
  const doRsvp = async (ans?: string) => {
    setBusy(true);
    try {
      const updated = await rsvpEvent(event.id, me, ans);
      ev.setData(updated);
      message.success(
        updated.myRsvp?.status === "waitlist"
          ? tr("You're on the waitlist (#{waitlistPosition}).", { waitlistPosition: updated.myRsvp.waitlistPosition })
          : tr("You're going! Session invitation reserved.")
      );
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
      message.success(tr("Your RSVP was cancelled."));
      void attendees.reload();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const attend = () => (event.rsvpQuestion ? setAnswerOpen(true) : doRsvp());

  const handlePostSubmit = async (text: string, kind: EventPost["kind"]) => {
    const updatedPosts = await addEventPost(event.id, me, text, kind);
    posts.setData(updatedPosts);
    message.success(
      kind === "announcement"
        ? tr("Announcement broadcasted to everyone registered")
        : tr("Message posted to discussion")
    );
  };

  const handlePinToggle = async (postId: string, currentPinned: boolean) => {
    try {
      const updatedPosts = await pinEventPost(event.id, postId, !currentPinned, me);
      posts.setData(updatedPosts);
      message.success(!currentPinned ? tr("Post pinned to top") : tr("Post unpinned"));
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  // ---- Primary Call to Action Button Engine ----
  let primaryAction: React.ReactNode;
  if (event.isHost) {
    primaryAction = (
      <Button
        type="primary"
        size="large"
        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
        onClick={() => router.push(`/training/mentor/events/${event.id}`)}
      >
        {tr("Manage Event & Attendees")}
      </Button>
    );
  } else if (phase === "cancelled") {
    primaryAction = (
      <Button size="large" disabled className="font-bold">
        {tr("Event Cancelled")}
      </Button>
    );
  } else if (phase === "draft") {
    primaryAction = (
      <Button size="large" disabled className="font-bold">
        {tr("Draft Preview Only")}
      </Button>
    );
  } else if (phase === "ended") {
    primaryAction = (
      <Button size="large" disabled className="font-bold">
        {tr("Event Concluded")}
      </Button>
    );
  } else if (phase === "live") {
    primaryAction =
      going && event.format === "online" && event.meetLink ? (
        <Button
          type="primary"
          size="large"
          href={event.meetLink}
          target="_blank"
          icon={<VideoCameraOutlined />}
          className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md animate-pulse"
        >
          {tr("Join Google Meet Now")}
        </Button>
      ) : going ? (
        <Button size="large" disabled className="font-bold bg-slate-100 text-slate-700">
          {tr("Happening Now · {venue}", { venue: trData(venue) })}
        </Button>
      ) : (
        <Button size="large" disabled className="font-bold">
          {tr("Registration Closed")}
        </Button>
      );
  } else if (rsvp === "going") {
    primaryAction = (
      <Dropdown
        trigger={["click"]}
        menu={{
          items: [
            ...(event.rsvpQuestion
              ? [
                  {
                    key: "answer",
                    label: tr("Edit my registration answer"),
                    onClick: () => {
                      setAnswer(event.myRsvp?.answer ?? "");
                      setAnswerOpen(true);
                    },
                  },
                ]
              : []),
            {
              key: "cancel",
              danger: true,
              label: tr("Cancel my seat (Free up spot)"),
              onClick: () =>
                modal.confirm({
                  title: tr("Cancel your RSVP?"),
                  content: tr("Your reserved seat will be assigned to the next engineer on the waitlist."),
                  okText: tr("Release Seat"),
                  okButtonProps: { danger: true },
                  cancelText: tr("Keep My Seat"),
                  onOk: doCancel,
                }),
            },
          ],
        }}
      >
        <Button
          type="primary"
          size="large"
          loading={busy}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm"
        >
          <span>{tr("You're Going ✓")}</span>
          <DownOutlined className="text-xs" />
        </Button>
      </Dropdown>
    );
  } else if (rsvp === "waitlist") {
    primaryAction = (
      <Popconfirm
        title={tr("Leave the waitlist?")}
        description={tr("You will lose your position on the queue.")}
        onConfirm={doCancel}
        okText={tr("Leave")}
        cancelText={tr("Stay on Queue")}
      >
        <Button size="large" loading={busy} className="font-bold border-amber-300 text-amber-900 bg-amber-50">
          {tr("On Waitlist (#{waitlistPosition}) · Leave Queue", { waitlistPosition: event.myRsvp?.waitlistPosition })}
        </Button>
      </Popconfirm>
    );
  } else if (phase === "closed") {
    primaryAction = (
      <Button size="large" disabled className="font-bold">
        {tr("Registration Closed")}
      </Button>
    );
  } else if (phase === "notOpen") {
    primaryAction = (
      <Button size="large" disabled className="font-bold text-xs">
        {tr("Opens")}{" "}
        {new Date(event.rsvpOpensAt!).toLocaleDateString(intlLocale(), {
          timeZone: "Asia/Kolkata",
          month: "short",
          day: "numeric",
        })}
      </Button>
    );
  } else if (event.spotsLeft <= 0) {
    primaryAction = event.waitlistEnabled ? (
      <Button
        type="primary"
        size="large"
        loading={busy}
        onClick={attend}
        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
      >
        {tr("Join Waitlist")}
      </Button>
    ) : (
      <Button size="large" disabled className="font-bold">
        {tr("Session Full")}
      </Button>
    );
  } else {
    primaryAction = (
      <Button
        type="primary"
        size="large"
        loading={busy}
        onClick={attend}
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md hover:shadow-lg transition-all active:scale-98"
      >
        {tr("Attend Masterclass")}
      </Button>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-6 pt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Cancelled Banner */}
        {event.status === "cancelled" && (
          <Alert
            type="error"
            showIcon
            message={tr("This event was cancelled")}
            description={event.cancelReason || tr("The session host has cancelled this masterclass.")}
            className="rounded-2xl border-red-200"
          />
        )}

        {/* Meetup layout: left = header + details, right = cover + date/location (sticky), bottom = recommendations.
            On mobile the order is header → cover/date → details. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-6 items-start">
          <div className="lg:col-span-7 min-w-0">
            <EventHeroBanner event={event} />
          </div>

          {/* RIGHT COLUMN: cover image, date/time, location, RSVP */}
          <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6 flex flex-col gap-4 min-w-0">
            <EventCoverImage event={event} />
            <EventLogisticsCard
              event={event}
              primaryAction={primaryAction}
              going={going}
              phase={phase}
            />
          </div>

          {/* LEFT COLUMN: Deep Content & Interactions */}
          <main className="lg:col-span-7 flex flex-col gap-6 min-w-0">
            {/* Quick 4-Item Highlights Metric Strip */}
            <EventHighlightsBar event={event} />

            {/* Event Details Card */}
            <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xl font-bold text-slate-900 m-0">{tr("Details")}</h2>
                <span className="text-xs text-slate-400 font-medium">{tr("Session Overview")}</span>
              </div>

              {/* Rich text description */}
              <div className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap font-normal">
                {event.description || tr("No session description provided.")}
              </div>

              {/* Agenda Stepper Timeline */}
              {event.agenda && event.agenda.length > 0 && (
                <div className="mt-2 pt-4 border-t border-slate-100">
                  <EventAgendaTimeline agenda={event.agenda} />
                </div>
              )}

              {/* Target Audience / Prerequisites Callout */}
              {((event.audience.roles?.length ?? 0) > 0 || (event.audience.plantTypes?.length ?? 0) > 0) && (
                <div className="mt-2 bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-start gap-3">
                  <SafetyCertificateOutlined className="text-emerald-700 text-lg mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {tr("Target Audience & Roles")}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-1.5 items-center">
                      {(event.audience.roles ?? []).map((role) => (
                        <Tag key={role} color="green" className="text-xs font-semibold m-0">
                          {ROLE_LABEL[role] ?? role}
                        </Tag>
                      ))}
                      {(event.audience.plantTypes ?? []).map((plant) => (
                        <Tag key={plant} color="cyan" className="text-xs font-semibold m-0">
                          {tr("{plant} Plant", { plant: trData(plant) })}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {outsideAudience && (
                <Alert
                  type="info"
                  showIcon
                  icon={<ExclamationCircleOutlined className="text-blue-600" />}
                  message={tr("Cross-Disciplinary Learning")}
                  description={tr("This masterclass is primarily tailored for {join}. However, you are welcome to attend and cross-train.", { join: (event.audience.roles ?? [])
                    .map((r) => ROLE_LABEL[r] ?? r)
                    .join(", ") })}
                  className="rounded-xl border-blue-200 text-xs"
                />
              )}
            </section>

            {/* Related Topics Pill Chips (Meetup Signature) */}
            {event.topics && event.topics.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <TagOutlined className="text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900 m-0">{tr("Related Topics & Skills")}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.topics.map((topic) => (
                    <Link key={topic} href={`/training/explore?skill=${encodeURIComponent(topic)}`}>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-700 transition-colors cursor-pointer">
                        #{trData(topic)}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Event Chat & Discussion Engine */}
            <EventChatSection
              event={event}
              posts={posts.data ?? null}
              loading={posts.loading}
              canPost={canPost}
              isHost={event.isHost}
              currentUserId={me}
              onPostSubmit={handlePostSubmit}
              onPinToggle={handlePinToggle}
              onAttendClick={attend}
            />

            {/* Attendees Social Proof Grid */}
            <EventAttendeesSection
              attendees={attendees.data ?? null}
              loading={attendees.loading}
              goingCount={event.goingCount}
              registered={registered}
              onAttendClick={attend}
            />

            {/* Host / Mentor Spotlight */}
            <EventHostCard hosts={event.hosts} />

            {/* After the Event / Recording Archive (if ended) */}
            {phase === "ended" && (going || event.isHost) && (
              <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <BookOutlined className="text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900 m-0">{tr("Post-Session Resources")}</h2>
                </div>
                {event.recordingUrl ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-950">
                      {tr("Recording and session slide deck are available")}
                    </span>
                    <a
                      href={event.recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                    >
                      {tr("Watch Recording")}
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 m-0">
                    {tr("No recording was published for this session. Feel free to leave questions in the discussion above.")}
                  </p>
                )}
              </section>
            )}
          </main>
        </div>

        {/* BOTTOM: "You May Also Like" Similar Events Discovery Shelf (full width) */}
        {(similar.data ?? []).length > 0 && (
          <section className="flex flex-col gap-4 pt-6 border-t border-slate-200/80">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 m-0">{tr("You May Also Like")}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tr("Similar engineering workshops and plant masterclasses")}
                </p>
              </div>
              <Link
                href="/training/events"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                {tr("See all events →")}
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
              {(similar.data ?? []).slice(0, 3).map((sim) => (
                <EventImageCard key={sim.id} event={sim} />
              ))}
            </div>
          </section>
        )}

        {/* Floating Bottom Sticky Bar for Zero-Friction RSVP */}
        <EventStickyBottomBar
          event={event}
          primaryAction={primaryAction}
          going={going}
          phase={phase}
        />
      </div>

      {/* RSVP Custom Question Modal */}
      <Modal
        open={answerOpen}
        title={
          <div className="flex items-center gap-2">
            <SafetyCertificateOutlined className="text-emerald-600" />
            <span>{event.rsvpQuestion || tr("RSVP Question")}</span>
          </div>
        }
        okText={rsvp === "going" ? tr("Update Answer") : tr("Confirm Seat")}
        confirmLoading={busy}
        onOk={() => doRsvp(answer)}
        onCancel={() => setAnswerOpen(false)}
        okButtonProps={{
          disabled: !answer.trim(),
          className: "bg-emerald-600 font-bold",
        }}
        className="rounded-2xl"
      >
        <p className="text-xs text-slate-500 mt-1 mb-3">
          {tr("The facilitator asks this to prepare relevant operational examples. Only session hosts can see your answer.")}
        </p>
        <Input.TextArea
          rows={3}
          maxLength={300}
          showCount
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={tr("E.g., Dealing with stage 2 evaporator vacuum drop during night shifts...")}
          className="rounded-xl text-sm"
        />
      </Modal>
    </div>
  );
}
