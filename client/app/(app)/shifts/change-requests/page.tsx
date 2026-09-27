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
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
          }}
        >
          Shift change requests
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          Supervisor or employee requests a shift change. Shift In-Charge, Manager,
          or Admin approve it when the day is not on leave and rest rules hold.
        </p>
      </div>

      <Table
        rowKey="id"
        dataSource={rows}
        style={{ background: nectarColors.white }}
        columns={[
          { title: "Employee", dataIndex: "employeeName" },
          {
            title: "Site",
            dataIndex: "siteId",
            render: (id) => getSiteName(id),
          },
          { title: "Date", dataIndex: "date" },
          {
            title: "Change",
            key: "chg",
            render: (_, r) =>
              `${getShiftMasterById(r.fromShiftId)?.code ?? "?"} → ${
                getShiftMasterById(r.toShiftId)?.code ?? "?"
              }`,
          },
          { title: "Reason", dataIndex: "reason" },
          { title: "Requested by", dataIndex: "requestedBy" },
          {
            title: "Manpower",
            dataIndex: "manpowerOk",
            render: (ok: boolean) =>
              ok ? (
                <Tag color={nectarColors.mint}>No shortage</Tag>
              ) : (
                <Tag color={nectarColors.alert}>Shortage</Tag>
              ),
          },
          {
            title: "Potential OT",
            dataIndex: "potentialOtHours",
            render: (h: number) =>
              h > 0 ? (
                <span style={{ color: nectarColors.alert }}>+{h} hrs</span>
              ) : (
                "0 hrs"
              ),
          },
          {
            title: "Status",
            dataIndex: "status",
            render: (s) => <Tag>{s}</Tag>,
          },
          {
            title: "Action",
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
                        message.success("Shift change approved");
                        setTick((t) => t + 1);
                      } catch (err) {
                        message.error(
                          err instanceof Error
                            ? err.message
                            : "Could not approve this shift change",
                        );
                      }
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      decideChangeRequest(r.id, "REJECTED");
                      message.info("Shift change rejected");
                      setTick((t) => t + 1);
                    }}
                  >
                    Reject
                  </Button>
                </>
              ) : r.status === "PENDING" ? (
                <span style={{ color: nectarColors.muted, fontSize: 12 }}>
                  Awaiting shift in-charge / manager
                </span>
              ) : (
                "—"
              ),
          },
        ]}
      />
    </div>
  );
}
