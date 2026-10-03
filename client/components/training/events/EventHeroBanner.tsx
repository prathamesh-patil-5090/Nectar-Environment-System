"use client";

import Link from "next/link";
import { Avatar, Tag } from "antd";
import { CheckCircleFilled, EnvironmentOutlined, TeamOutlined, VideoCameraOutlined } from "@ant-design/icons";
import type { TrainingEvent } from "@/lib/training/types";
import { EVENT_TYPE_LABEL, eventCoverUrl } from "@/components/training/ui/EventCard";
import Cover from "@/components/training/ui/Cover";

interface EventHeroBannerProps {
  event: TrainingEvent;
}

export default function EventHeroBanner({ event }: EventHeroBannerProps) {
  const host = event.hosts?.[0];

  return (
    <div className="w-full flex flex-col gap-5">
      {/* 1. Breadcrumbs & Category Pill */}
      <nav aria-label="Breadcrumbs" className="flex items-center gap-2 text-xs font-medium text-slate-500 flex-wrap">
        <Link href="/training" className="hover:text-emerald-700 transition-colors">
          Training Hub
        </Link>
        <span>/</span>
        <Link href="/training/events" className="hover:text-emerald-700 transition-colors">
          Events & Masterclasses
        </Link>
        {event.community && (
          <>
            <span>/</span>
            <Link
              href={`/training/communities/${event.community.slug}`}
              className="text-emerald-700 hover:text-emerald-800 font-semibold transition-colors"
            >
              {event.community.name}
            </Link>
          </>
        )}
      </nav>

      {/* 2. Title & Co-Branded Host Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            {event.format === "online" ? <VideoCameraOutlined /> : <EnvironmentOutlined />}
            {EVENT_TYPE_LABEL[event.type] || "Masterclass"}
          </span>
          {event.community && (
            <Link href={`/training/communities/${event.community.slug}`}>
              <Tag className="rounded-full px-2.5 py-0.5 border-slate-200 text-slate-700 hover:border-emerald-600 transition-colors cursor-pointer">
                <TeamOutlined className="mr-1 text-slate-500" />
                {event.community.name}
              </Tag>
            </Link>
          )}
          {event.status === "draft" && <Tag color="default">Draft Preview</Tag>}
          {event.status === "cancelled" && <Tag color="error">Cancelled</Tag>}
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
          {event.title}
        </h1>

        {/* Host & Community Attribution Bar */}
        <div className="flex items-center gap-3 pt-1 flex-wrap text-sm text-slate-600">
          {host && (
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 rounded-full pl-1 pr-3 py-1 shadow-sm">
              <Avatar
                size={30}
                src={host.photoUrl || (host.name.includes("Sanjay") ? "/mentors/mentor_sanjay.jpg" : undefined)}
                className="bg-emerald-700 text-white font-bold"
              >
                {host.name[0]}
              </Avatar>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-xs">Hosted by</span>
                <span className="font-semibold text-slate-900">{host.name}</span>
                <CheckCircleFilled className="text-emerald-600 text-xs" title="Certified Mentor" />
                {host.designation && (
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    · {host.designation}
                  </span>
                )}
              </div>
            </div>
          )}

          {event.assignedBy && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#1C4463] text-white">
              Assigned by {event.assignedBy.name}
            </span>
          )}

          {event.community && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>organized for</span>
              <Link
                href={`/training/communities/${event.community.slug}`}
                className="font-medium text-emerald-700 hover:underline"
              >
                {event.community.name}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sidebar cover card — the whole image stays visible whatever its aspect ratio. */
export function EventCoverImage({ event }: EventHeroBannerProps) {
  const coverUrl = eventCoverUrl(event);
  if (!coverUrl) {
    return (
      <div className="bg-white rounded-3xl p-2 border border-slate-200/90 shadow-md">
        <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden">
          <Cover label={event.title} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-2 border border-slate-200/90 shadow-md">
      <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-slate-950">
        {/* Blurred fill so the full image fits without cropping or empty bars */}
        <img
          src={coverUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
        />
        <img src={coverUrl} alt={event.title} className="relative w-full h-full object-contain object-center" />
      </div>
    </div>
  );
}
