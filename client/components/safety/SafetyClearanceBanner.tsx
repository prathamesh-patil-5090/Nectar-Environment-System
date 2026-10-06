"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Tag } from "antd";
import { SafetyOutlined } from "@ant-design/icons";
import { getPendingClearances } from "@/lib/api/safety";
import { getSafetyEvents, subscribeSafety } from "@/lib/safety/store";
import { pendingClearanceFor, type PendingClearanceRef } from "@/lib/safety/gates";
import type { SafetyEvent } from "@/lib/safety/types";
import { tr, trData, trNode } from "@/lib/i18n";

const EMPTY: SafetyEvent[] = [];

/** Pending return-to-work clearance for one employee — cache first, then confirmed by the API. */
function usePendingClearance(employeeId?: string): PendingClearanceRef[] {
  const events = useSyncExternalStore(subscribeSafety, getSafetyEvents, () => EMPTY);
  const [live, setLive] = useState<PendingClearanceRef[] | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    let alive = true;
    getPendingClearances(employeeId)
      .then((rows) => alive && setLive(rows.map((r) => ({ eventId: r.eventId, title: r.title, employeeId: r.employeeId }))))
      .catch(() => alive && setLive(null));
    return () => {
      alive = false;
    };
  }, [employeeId, events]);

  if (!employeeId) return [];
  return live ?? pendingClearanceFor(employeeId, events);
}

/** Banner on leave pages: this person can't be returned to duty until Safety clears them. */
export default function SafetyClearanceBanner({ employeeId }: { employeeId?: string }) {
  const pending = usePendingClearance(employeeId);
  if (!pending.length) return null;
  return (
    <Alert
      type="warning"
      showIcon
      icon={<SafetyOutlined />}
      style={{ marginBottom: 16 }}
      title={tr("Safety clearance pending — return to duty is blocked")}
      description={
        <span>
          {trNode("Safety In-charge or Manager must clear this person on {cases} before this leave can be closed.", {
            cases: pending.map((p, i) => (
              <span key={p.eventId}>
                {i ? ", " : ""}
                <Link href={`/safety/incidents/${p.eventId}`}>{trData(p.title)}</Link>
              </span>
            )),
          })}
        </span>
      }
    />
  );
}

/** Compact tag for list rows. */
export function SafetyClearanceTag({ employeeId }: { employeeId?: string }) {
  const events = useSyncExternalStore(subscribeSafety, getSafetyEvents, () => EMPTY);
  const pending = employeeId ? pendingClearanceFor(employeeId, events) : [];
  if (!pending.length) return null;
  return (
    <Link href={`/safety/incidents/${pending[0].eventId}`}>
      <Tag color="orange" icon={<SafetyOutlined />}>{tr("Safety clearance pending")}</Tag>
    </Link>
  );
}
