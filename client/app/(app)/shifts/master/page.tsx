"use client";

import { InputNumber, Table, Tag } from "antd";
import { useState } from "react";
import {
  restRules,
  rotationPatterns,
  shiftMaster,
  updateRestRules,
} from "@/lib/shift";
import { nectarColors } from "@/lib/theme";

export default function ShiftMasterPage() {
  const [minRest, setMinRest] = useState(restRules.minimumRestHours);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Intro
        title="Shift Master"
        body="Configurable shift definitions and rest rules. Rest hours are organization-configured — HR/compliance validates the value."
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
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>
            Minimum rest hours between shifts{" "}
            <InputNumber
              min={8}
              max={24}
              value={minRest}
              onChange={(v) => {
                const n = Number(v) || 11;
                setMinRest(n);
                updateRestRules({ minimumRestHours: n });
              }}
            />
          </label>
          <span style={{ fontSize: 13, color: nectarColors.muted }}>
            Weekly off day: Sunday (configurable) · Weekly-off OT enabled:{" "}
            {restRules.weeklyOffOtEnabled ? "Yes" : "No"}
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
        border: "1px solid rgba(15,42,36,0.06)",
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
