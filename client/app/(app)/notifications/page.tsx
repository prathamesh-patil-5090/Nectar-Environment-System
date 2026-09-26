"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Empty, Listy, Tag } from "antd";
import { getSession } from "@/lib/auth";
import {
  getNotificationsForEmployee,
  markAllRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";
import {
  getOtAssignments,
  updateOtAssignmentStatus,
  type OtAssignment,
} from "@/lib/overtime";
import { selfEmployeeId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

const kindLabel: Record<AppNotification["kind"], string> = {
  leave_consent: "Leave consent",
  leave_decision: "Leave decision",
  ot_assign: "OT assignment",
  shift_message: "Shift In-Charge",
  manager_message: "Manager",
  general: "General",
};

function NotificationRow({
  item,
  onOpen,
}: {
  item: AppNotification;
  onOpen: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 0",
        borderBottom: `1px solid ${nectarColors.sand}`,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {!item.read ? (
            <Tag color={nectarColors.leaf} style={{ marginRight: 8 }}>
              New
            </Tag>
          ) : null}
          {item.title}
          <Tag style={{ marginLeft: 8 }}>{kindLabel[item.kind]}</Tag>
        </div>
        <div style={{ fontSize: 13, color: nectarColors.ink }}>{item.body}</div>
        <div style={{ fontSize: 11, marginTop: 4, color: nectarColors.muted }}>
          {item.createdAt.slice(0, 16).replace("T", " ")}
        </div>
      </div>
      <Button type="link" onClick={onOpen}>
        Open
      </Button>
    </div>
  );
}

function OtRow({
  item,
  onAck,
}: {
  item: OtAssignment;
  onAck: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 0",
        borderBottom: `1px solid ${nectarColors.sand}`,
      }}
    >
      <div>
        <div style={{ fontWeight: 600 }}>
          {item.date} · {item.hours}h · <Tag>{item.status}</Tag>
        </div>
        <div style={{ fontSize: 13, color: nectarColors.muted }}>
          {item.reason} — assigned by {item.assignedBy}
        </div>
        {item.notes ? (
          <div style={{ fontSize: 12, color: nectarColors.muted, marginTop: 4 }}>
            {item.notes}
          </div>
        ) : null}
      </div>
      {item.status === "assigned" ? (
        <Button type="primary" size="small" onClick={onAck}>
          Acknowledge
        </Button>
      ) : null}
    </div>
  );
}

export default function NotificationsPage() {
  const { message } = App.useApp();
  const session = getSession();
  const router = useRouter();
  const empId = selfEmployeeId(session);
  const [tick, setTick] = useState(0);

  const notifications = useMemo(() => {
    void tick;
    return empId ? getNotificationsForEmployee(empId) : [];
  }, [empId, tick]);

  const otAssignments = useMemo(() => {
    void tick;
    return empId ? getOtAssignments({ employeeId: empId }) : [];
  }, [empId, tick]);

  if (!empId) {
    return (
      <Empty description="Notifications require an employee profile on your login." />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
          Leave consent, leave decisions, and OT assignments for your employee
          record.
        </p>
        <Button
          onClick={() => {
            markAllRead(empId);
            setTick((t) => t + 1);
          }}
        >
          Mark all read
        </Button>
      </div>

      <div
        style={{
          background: nectarColors.white,
          padding: 20,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          Inbox
        </div>
        {notifications.length === 0 ? (
          <Empty description="No notifications yet" />
        ) : (
          <Listy
            items={notifications}
            rowKey="id"
            itemRender={(item) => (
              <NotificationRow
                item={item}
                onOpen={() => {
                  markNotificationRead(item.id);
                  setTick((t) => t + 1);
                  if (item.href) router.push(item.href);
                }}
              />
            )}
          />
        )}
      </div>

      <div
        style={{
          background: nectarColors.white,
          padding: 20,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          My OT assignments
        </div>
        {otAssignments.length === 0 ? (
          <Empty description="No OT assignments" />
        ) : (
          <Listy
            items={otAssignments}
            rowKey="id"
            itemRender={(a) => (
              <OtRow
                item={a}
                onAck={() => {
                  updateOtAssignmentStatus(a.id, "acknowledged");
                  message.success("OT assignment acknowledged");
                  setTick((t) => t + 1);
                }}
              />
            )}
          />
        )}
        <div style={{ marginTop: 8, fontSize: 12, color: nectarColors.muted }}>
          Managers assign OT from{" "}
          <Link href="/overtime/assign">OverTime → Assign / notify</Link>.
        </div>
      </div>
    </div>
  );
}
