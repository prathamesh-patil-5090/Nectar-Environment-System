"use client";

import { useMemo, useState } from "react";
import { App, Button, Table, Tag } from "antd";
import { getSession } from "@/lib/auth";
import { getSiteName } from "@/lib/mock-data";
import {
  decideChangeRequest,
  getChangeRequests,
  getShiftMasterById,
} from "@/lib/shift";
import { canApproveShiftChanges, scopedSiteId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { sSerifText22 } from "@/lib/styles";
import { tr, trCell, trData } from "@/lib/i18n";

export default function ShiftChangeRequestsPage() {
  const { message } = App.useApp();
  const session = getSession();
  const canApprove = canApproveShiftChanges(session);
  const siteScope = scopedSiteId(session);
  const [tick, setTick] = useState(0);
  const rows = useMemo(() => {
    void tick;
    return getChangeRequests(siteScope);
  }, [tick, siteScope]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={sSerifText22}>{tr("Shift change requests")}</div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          {tr("Supervisor or employee requests a shift change. Shift In-Charge, Manager, or Director approve it when the day is not on leave and rest rules hold.")}
        </p>
      </div>

      <Table
        rowKey="id"
        dataSource={rows}
        style={{ background: nectarColors.white }}
        columns={[
          { title: tr("Employee"), dataIndex: "employeeName", render: trCell },
          { title: tr("Site"), dataIndex: "siteId", render: (id) => trData(getSiteName(id)) },
          { title: tr("Date"), dataIndex: "date" },
          {
            title: tr("Change"),
            key: "chg",
            render: (_, r) =>
              `${getShiftMasterById(r.fromShiftId)?.code ?? "?"} → ${
                getShiftMasterById(r.toShiftId)?.code ?? "?"
              }`,
          },
          { title: tr("Reason"), dataIndex: "reason", render: trCell },
          { title: tr("Requested by"), dataIndex: "requestedBy", render: trCell },
          {
            title: tr("Manpower"),
            dataIndex: "manpowerOk",
            render: (ok: boolean) =>
              ok ? (
                <Tag color={nectarColors.mint}>{tr("No shortage")}</Tag>
              ) : (
                <Tag color={nectarColors.alert}>{tr("Shortage")}</Tag>
              ),
          },
          {
            title: tr("Potential OT"),
            dataIndex: "potentialOtHours",
            render: (h: number) =>
              h > 0 ? (
                <span style={{ color: nectarColors.alert }}>{tr("+{h} hrs", { h })}</span>
              ) : (
                tr("0 hrs")
              ),
          },
          { title: tr("Status"), dataIndex: "status", render: (s) => <Tag>{trData(s)}</Tag> },
          {
            title: tr("Action"),
            key: "act",
            render: (_, r) =>
              r.status === "PENDING" && canApprove ? (
                <>
                  <Button
                    size="small"
                    type="primary"
                    style={{ marginRight: 6 }}
                    onClick={() => {
                      try {
                        decideChangeRequest(r.id, "APPROVED");
                        message.success(tr("Shift change approved"));
                        setTick((t) => t + 1);
                      } catch (err) {
                        message.error(
                          err instanceof Error
                            ? trData(err.message)
                            : tr("Could not approve this shift change"),
                        );
                      }
                    }}
                  >
                    {tr("Approve")}
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      decideChangeRequest(r.id, "REJECTED");
                      message.info(tr("Shift change rejected"));
                      setTick((t) => t + 1);
                    }}
                  >
                    {tr("Reject")}
                  </Button>
                </>
              ) : r.status === "PENDING" ? (
                <span style={{ color: nectarColors.muted, fontSize: 12 }}>{tr("Awaiting shift in-charge / manager")}</span>
              ) : (
                "—"
              ),
          },
        ]}
      />
    </div>
  );
}
