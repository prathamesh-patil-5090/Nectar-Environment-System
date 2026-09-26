"use client";

import { InputNumber, Switch, Table, Tag } from "antd";
import { useMemo, useState } from "react";
import { getSession } from "@/lib/auth";
import {
  getRestRules,
  rotationPatterns,
  shiftMaster,
  updateRestRules,
} from "@/lib/shift";
import { canManageShifts } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

export default function ShiftMasterPage() {
  const session = getSession();
  const canEdit = canManageShifts(session);
  const [tick, setTick] = useState(0);
  const rules = useMemo(() => {
    void tick;
    return getRestRules();
  }, [tick]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Intro
        title="Shift Master"
        body="Configurable shift definitions and rest rules. Rest hours are organization-configured — HR/compliance validates the value. Edits are saved for this browser demo."
      />

      <Panel title="Shifts">
        <Table
          rowKey="id"
          pagination={false}
          dataSource={shiftMaster}
          columns={[
            {
              title: "Code",
              dataIndex: "code",
              render: (c, r) => <Tag color={r.color}>{c}</Tag>,
            },
            { title: "Name", dataIndex: "name" },
            { title: "Start", dataIndex: "startTime" },
            { title: "End", dataIndex: "endTime" },
            { title: "Hours", dataIndex: "scheduledHours" },
            { title: "Break (min)", dataIndex: "breakMinutes" },
          ]}
        />
      </Panel>

      <Panel title="Rotation patterns">
        <Table
          rowKey="id"
          pagination={false}
          dataSource={rotationPatterns}
          columns={[
            { title: "Pattern", dataIndex: "name" },
            { title: "Description", dataIndex: "description" },
            {
              title: "Sequence",
              dataIndex: "sequence",
              render: (seq: string[]) => seq.join(" → "),
            },
            { title: "Period (days)", dataIndex: "periodDays" },
          ]}
        />
      </Panel>

      <Panel title="Rest & weekly-off rules">
        {!canEdit ? (
          <p style={{ margin: 0, color: nectarColors.muted, fontSize: 13 }}>
            View only — Shift In-Charge / Manager can edit rest rules.
          </p>
        ) : null}
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: canEdit ? 0 : 8,
          }}
        >
          <label style={{ fontSize: 13 }}>
            Minimum rest hours between shifts{" "}
            <InputNumber
              min={8}
              max={24}
              disabled={!canEdit}
              value={rules.minimumRestHours}
              onChange={(v) => {
                if (!canEdit) return;
                updateRestRules({ minimumRestHours: Number(v) || 11 });
                setTick((t) => t + 1);
              }}
            />
          </label>
          <label
            style={{
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Weekly-off OT enabled
            <Switch
              disabled={!canEdit}
              checked={rules.weeklyOffOtEnabled}
              onChange={(checked) => {
                if (!canEdit) return;
                updateRestRules({ weeklyOffOtEnabled: checked });
                setTick((t) => t + 1);
              }}
            />
          </label>
          <span style={{ fontSize: 13, color: nectarColors.muted }}>
            Weekly off day: Sunday (demo fixed)
          </span>
        </div>
      </Panel>
    </div>
  );
}

function Intro({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontSize: 22,
          color: nectarColors.ink,
        }}
      >
        {title}
      </div>
      <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>{body}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: nectarColors.white,
        padding: 20,
        borderRadius: 10,
        border: "1px solid rgba(28, 68, 99, 0.08)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontSize: 18,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
