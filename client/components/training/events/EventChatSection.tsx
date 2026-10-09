"use client";

import { useState } from "react";
import { Avatar, Button, Empty, Input, Segmented, Skeleton, Tag, Tooltip } from "antd";
import {
  CommentOutlined,
  LockOutlined,
  PushpinFilled,
  PushpinOutlined,
  SendOutlined,
} from "@ant-design/icons";
import type { EventPost, TrainingEvent } from "@/lib/training/types";
import { tr, translatePersonName, intlLocale, trData } from "@/lib/i18n";

interface EventChatSectionProps {
  event: TrainingEvent;
  posts: EventPost[] | null;
  loading: boolean;
  canPost: boolean;
  isHost: boolean;
  currentUserId: string;
  onPostSubmit: (text: string, kind: EventPost["kind"]) => Promise<void>;
  onPinToggle: (postId: string, currentPinned: boolean) => Promise<void>;
  onAttendClick: () => void;
}

export default function EventChatSection({
  event,
  posts,
  loading,
  canPost,
  isHost,
  onPostSubmit,
  onPinToggle,
  onAttendClick,
}: EventChatSectionProps) {
  const [postText, setPostText] = useState("");
  const [postKind, setPostKind] = useState<EventPost["kind"]>("question");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!postText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onPostSubmit(postText.trim(), postKind);
      setPostText("");
    } finally {
      setSubmitting(false);
    }
  };

  const allPosts = posts ?? [];
  const pinned = allPosts.filter((p) => p.pinned);
  const regular = allPosts.filter((p) => !p.pinned);
  const orderedPosts = [...pinned, ...regular];

  return (
    <div id="discussion" className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CommentOutlined />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 m-0 leading-tight">
              {tr("Event Chat & Discussion")}
            </h2>
            <div className="text-xs text-slate-500">
              {tr("Q&A, technical questions, and announcements")}
            </div>
          </div>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          {allPosts.length} {allPosts.length === 1 ? tr("message") : tr("messages")}
        </span>
      </div>

      {/* Composer or Gated Callout (Meetup signature) */}
      {canPost ? (
        <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Segmented
              value={postKind}
              onChange={(val) => setPostKind(val as EventPost["kind"])}
              options={[
                { value: "question", label: tr("Ask a Question") },
                { value: "comment", label: tr("General Comment") },
                ...(isHost
                  ? [{ value: "announcement", label: tr("Announcement (Notifies All)") }]
                  : []),
              ]}
              className="text-xs font-medium"
            />
            <span className="text-[11px] text-slate-400">
              {postKind === "question"
                ? tr("Host will address your question during the session")
                : postKind === "announcement"
                ? tr("Broadcast to all registered attendees")
                : tr("Share your thoughts with the team")}
            </span>
          </div>

          <Input.TextArea
            rows={2}
            maxLength={500}
            showCount
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder={
              postKind === "question"
                ? tr("Ask the mentor something to cover (e.g. vacuum pump seal leak symptoms)...")
                : postKind === "announcement"
                ? tr("Write an urgent announcement for all participants...")
                : tr("Leave a comment or share your experience...")
            }
            className="rounded-lg text-sm"
          />

          <div className="flex justify-end">
            <Button
              type="primary"
              loading={submitting}
              disabled={!postText.trim()}
              onClick={handleSubmit}
              icon={<SendOutlined />}
              className="rounded-xl px-5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {tr("Post Message")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shrink-0">
              <LockOutlined />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-emerald-950">
                {tr("Attend to join the conversation")}
              </div>
              <div className="text-xs text-emerald-800">
                {event.hosts[0]?.name
                  ? tr("Connect with attendees and submit questions for {host} before the event starts.", { host: translatePersonName(event.hosts[0].name) })
                  : tr("Connect with attendees and submit questions for the host before the event starts.")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onAttendClick}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            {tr("Attend to Join Chat")}
          </button>
        </div>
      )}

      {/* Posts List */}
      {loading ? (
        <Skeleton active avatar paragraph={{ rows: 2 }} />
      ) : orderedPosts.length === 0 ? (
        <div className="py-8">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span className="text-xs text-slate-500">
                {tr("No discussion messages yet. Start the conversation!")}
              </span>
            }
          />
        </div>
      ) : (
        <div className="divide-y divide-slate-100 flex flex-col">
          {orderedPosts.map((post) => (
            <div
              key={post.id}
              className={`py-3.5 flex items-start gap-3 transition-colors ${
                post.pinned ? "bg-amber-50/40 -mx-2 px-3 rounded-xl border border-amber-200/50 mb-2" : ""
              }`}
            >
              <Avatar
                size={38}
                src={post.author?.photoUrl}
                className="bg-emerald-800 text-white font-semibold shrink-0"
              >
                {post.author?.name?.[0] || "?"}
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-slate-900">
                      {post.author?.name || post.authorEmployeeId}
                    </span>
                    {post.author?.designation && (
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        · {trData(post.author.designation)}
                      </span>
                    )}
                    {post.kind !== "comment" && (
                      <Tag
                        color={post.kind === "announcement" ? "volcano" : "blue"}
                        className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0"
                      >
                        {trData(post.kind)}
                      </Tag>
                    )}
                    {post.pinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.2 rounded-md">
                        <PushpinFilled className="text-amber-600" />{" "}{tr("Pinned")}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400">
                    {new Date(post.createdAt).toLocaleString(intlLocale(), {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                <div className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {trData(post.text)}
                </div>
              </div>

              {isHost && (
                <Tooltip title={post.pinned ? tr("Unpin post") : tr("Pin post to top")}>
                  <Button
                    size="small"
                    type="text"
                    onClick={() => onPinToggle(post.id, post.pinned)}
                    className="text-slate-400 hover:text-amber-600 shrink-0"
                  >
                    {post.pinned ? <PushpinFilled className="text-amber-600" /> : <PushpinOutlined />}
                  </Button>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
