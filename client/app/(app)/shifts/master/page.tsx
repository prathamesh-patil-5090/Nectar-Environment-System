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
import { sSerifText18Mb12, sSerifText22Ink } from "@/lib/styles";
import SharedPanel from "@/components/Panel";
import { tr, trCell, trData } from "@/lib/i18n";

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
        title={tr("Shift Master")}
        body={tr("Configurable shift definitions and rest rules. Rest hours are organization-configured — HR/compliance validates the value. Edits are saved for this browser demo.")}
      />

      <Panel title={tr("Shifts")}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={shiftMaster}
          columns={[
            { title: tr("Code"), dataIndex: "code", render: (c, r) => <Tag color={r.color}>{trData(c)}</Tag> },
            { title: tr("Name"), dataIndex: "name", render: trCell },
            { title: tr("Start"), dataIndex: "startTime" },
            { title: tr("End"), dataIndex: "endTime" },
            { title: tr("Hours"), dataIndex: "scheduledHours", render: trCell },
            { title: tr("Break (min)"), dataIndex: "breakMinutes", render: trCell },
          ]}
        />
      </Panel>

      <Panel title={tr("Rotation patterns")}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={rotationPatterns}
          columns={[
            { title: tr("Pattern"), dataIndex: "name", render: trCell },
            { title: tr("Description"), dataIndex: "description", render: trCell },
            { title: tr("Sequence"), dataIndex: "sequence", render: (seq: string[]) => seq.join(" → ") },
            { title: tr("Period (days)"), dataIndex: "periodDays", render: trCell },
          ]}
        />
      </Panel>

      <Panel title={tr("Rest & weekly-off rules")}>
        {!canEdit ? (
          <p style={{ margin: 0, color: nectarColors.muted, fontSize: 13 }}>{tr("View only — Shift In-Charge / Manager can edit rest rules.")}</p>
        ) : null}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: canEdit ? 0 : 8 }}>
          <label style={{ fontSize: 13 }}>
            {tr("Minimum rest hours between shifts")}{" "}
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
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {tr("Weekly-off OT enabled")}
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
          <span style={{ fontSize: 13, color: nectarColors.muted }}>{tr("Weekly off day: Sunday (demo fixed)")}</span>
        </div>
      </Panel>
    </div>
  );
}

function Intro({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div style={sSerifText22Ink}>{trData(title)}</div>
      <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>{trData(body)}</p>
    </div>
  );
}

function Panel(props: { title: string; children: React.ReactNode }) {
  return <SharedPanel {...props} titleStyle={sSerifText18Mb12} />;
}
