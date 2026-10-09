"use client";

import Link from "next/link";
import { Avatar, Tag } from "antd";
import { ArrowRightOutlined, CheckCircleFilled, TrophyOutlined } from "@ant-design/icons";
import type { Person } from "@/lib/training/types";
import { tr, trData } from "@/lib/i18n";

interface EventHostCardProps {
  hosts: Person[];
}

export default function EventHostCard({ hosts }: EventHostCardProps) {
  if (!hosts || hosts.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 m-0">
          {hosts.length > 1 ? tr("Meet the Hosts") : tr("Meet the Host")}
        </h2>
        <span className="text-xs text-slate-500 font-medium">{tr("Session Facilitator")}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {hosts.map((host) => {
          const photoUrl =
            host.photoUrl ||
            (host.name.includes("Sanjay") ? "/mentors/mentor_sanjay.jpg" : undefined);

          return (
            <div
              key={host.id}
              className="group relative flex flex-col justify-between p-4 rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/50 to-white hover:border-emerald-600/60 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-3.5">
                <Avatar
                  size={52}
                  src={photoUrl}
                  className="bg-emerald-800 text-white font-bold ring-2 ring-emerald-500/20 shrink-0"
                >
                  {host.name[0]}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {trData(host.name)}
                    </span>
                    <CheckCircleFilled className="text-emerald-600 text-xs" />
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-0.5">
                    {host.designation || tr("Plant Lead")}
                  </div>
                  {host.siteName && (
                    <div className="mt-1">
                      <Tag color="cyan" className="text-[10px] px-1.5 py-0 leading-none">
                        {trData(host.siteName)}
                      </Tag>
                    </div>
                  )}
                </div>
              </div>

              {/* Bio snippet */}
              <p className="text-xs text-slate-600 mt-3 leading-relaxed line-clamp-2">
                {tr("Certified Nectar senior engineer with deep domain expertise in process stabilization, plant troubleshooting, and equipment maintenance.")}
              </p>

              {/* Action link */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <TrophyOutlined />{" "}{tr("Verified Mentor")}
                </span>
                <Link
                  href={`/training/events?host=${encodeURIComponent(host.id)}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
                >
                  {tr("More sessions")}{" "}<ArrowRightOutlined className="text-[10px]" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
