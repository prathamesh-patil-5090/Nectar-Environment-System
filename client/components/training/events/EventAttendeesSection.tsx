"use client";

import { Avatar, Skeleton, Tag } from "antd";
import { CheckCircleFilled, TeamOutlined, UserOutlined } from "@ant-design/icons";
import type { EventAttendee } from "@/lib/training/types";
import { tr, trData } from "@/lib/i18n";

interface EventAttendeesSectionProps {
  attendees: EventAttendee[] | null;
  loading: boolean;
  goingCount: number;
  registered: boolean;
  onAttendClick: () => void;
}

export default function EventAttendeesSection({
  attendees,
  loading,
  goingCount,
  registered,
  onAttendClick,
}: EventAttendeesSectionProps) {
  const confirmedAttendees = (attendees ?? []).filter(
    (a) => !a.status || a.status === "going" || a.status === "attended"
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <TeamOutlined />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 m-0 leading-tight">
              {tr("Attendees ({goingCount})", { goingCount })}
            </h2>
            <div className="text-xs text-slate-500">{tr("Colleagues and operators attending this session")}</div>
          </div>
        </div>

        {/* Avatar stack preview */}
        {confirmedAttendees.length > 0 && (
          <Avatar.Group max={{ count: 4 }} size="small">
            {confirmedAttendees.map((a) => (
              <Avatar key={a.employee.id} src={a.employee.photoUrl}>
                {a.employee.name[0]}
              </Avatar>
            ))}
          </Avatar.Group>
        )}
      </div>

      {/* Content based on registration */}
      {!registered ? (
        <div className="bg-slate-50/80 border border-dashed border-slate-300 rounded-xl p-6 text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            <UserOutlined />
          </div>
          <div className="max-w-md">
            <div className="font-semibold text-slate-800 text-sm">
              {tr("Attend to see the full roster")}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {goingCount > 0
                ? tr("Join {goingCount} other plant engineers to see who is going and connect with attendees.", { goingCount })
                : tr("Join the session to see who is going and connect with attendees.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onAttendClick}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            {tr("Attend to View Roster")}
          </button>
        </div>
      ) : loading ? (
        <Skeleton active avatar paragraph={{ rows: 2 }} />
      ) : confirmedAttendees.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-xs">
          {tr("Nobody has registered yet. Be the first to take a seat!")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {confirmedAttendees.map((a) => (
            <div
              key={a.employee.id}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all"
            >
              <Avatar
                size={40}
                src={a.employee.photoUrl}
                className="bg-emerald-700 text-white font-bold shrink-0"
              >
                {a.employee.name[0]}
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs text-slate-900 truncate flex items-center gap-1">
                  <span>{trData(a.employee.name)}</span>
                  <CheckCircleFilled className="text-emerald-600 text-[10px]" />
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {a.employee.designation || tr("Plant Personnel")}
                </div>
                {a.employee.siteName && (
                  <Tag className="mt-1 text-[10px] leading-tight px-1.5 py-0 border-slate-200 text-slate-600 bg-white">
                    {trData(a.employee.siteName)}
                  </Tag>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
