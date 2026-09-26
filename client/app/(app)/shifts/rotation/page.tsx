"use client";

import { useMemo, useState } from "react";
import { App, Button, Select, Table, Tag } from "antd";
import { getSession } from "@/lib/auth";
import { getSiteName, sites } from "@/lib/mock-data";
import {
  ACTIVE_PATTERN,
  EFFECTIVE,
  activateRotationPreview,
  generateNextRotation,
  getRotationPreviews,
  getRotationRows,
  getShiftByCode,
  rejectRotationPreview,
} from "@/lib/shift";
import { canManageShifts, scopedSiteId } from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

export default function ShiftRotationPage() {
  const { message } = App.useApp();
  const session = getSession();
  const locked = scopedSiteId(session);
  const canDecide = canManageShifts(session);
  const [siteId, setSiteId] = useState<string | undefined>(locked);
  const [tick, setTick] = useState(0);
  const rows = useMemo(() => {
    void tick;
    return getRotationRows(siteId);
  }, [siteId, tick]);
  const previews = useMemo(() => {
    void tick;
    return getRotationPreviews().filter((p) =>
      siteId ? p.siteId === siteId : true,
    );
  }, [siteId, tick]);

  const refresh = () => setTick((t) => t + 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
          }}
        >
          Employee rotation schedule
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          Pattern: <strong>{ACTIVE_PATTERN.name}</strong> —{" "}
          {ACTIVE_PATTERN.description} Next effective date:{" "}
          <strong>{EFFECTIVE}</strong>
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Select
          allowClear={!locked}
          placeholder="Site"
          style={{ width: 220 }}
          value={siteId}
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSiteId}
          disabled={Boolean(locked)}
        />
        <Button
          type="primary"
          disabled={!siteId || !canDecide}
          onClick={() => {
            if (!siteId || !canDecide) return;
            generateNextRotation(siteId);
            message.success("Next rotation draft generated for review.");
            refresh();
          }}
        >
          Generate next schedule
        </Button>
        {!canDecide ? (
          <span style={{ fontSize: 12, color: nectarColors.muted, alignSelf: "center" }}>
            Generate / approve requires Shift In-Charge or Manager
          </span>
        ) : null}
      </div>

      <Table
        rowKey="employeeId"
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        style={{ background: nectarColors.white }}
        columns={[
          { title: "Employee", dataIndex: "employeeName" },
          {
            title: "Site",
            dataIndex: "siteId",
            render: (id) => getSiteName(id),
          },
          { title: "Group", dataIndex: "groupId" },
          {
            title: "Current",
            dataIndex: "currentCode",
            render: (c) => (
              <Tag color={getShiftByCode(c)?.color}>{c}</Tag>
            ),
          },
          {
            title: "Next",
            dataIndex: "nextCode",
            render: (c) => (
              <Tag color={getShiftByCode(c)?.color}>{c}</Tag>
            ),
          },
          { title: "Effective", dataIndex: "effectiveDate" },
        ]}
      />

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
          Generated schedules pending review
        </div>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={previews}
          columns={[
            { title: "From", dataIndex: "fromDate" },
            { title: "To", dataIndex: "toDate" },
            {
              title: "Site",
              dataIndex: "siteId",
              render: (id) => getSiteName(id),
            },
            { title: "Employees", dataIndex: "employeesAffected" },
            {
              title: "Change",
              key: "ch",
              render: (_, r) => `${r.fromCode} → ${r.toCode}`,
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (s: string) => <Tag>{s.replaceAll("_", " ")}</Tag>,
            },
            {
              title: "Action",
              key: "act",
              render: (_, r) => {
                const undecided =
                  r.status === "pending_review" || r.status === "draft";
                if (!undecided) return "—";
                if (!canDecide) {
                  return (
                    <span style={{ color: nectarColors.muted, fontSize: 12 }}>
                      Awaiting shift in-charge
                    </span>
                  );
                }
                return (
                  <>
                    <Button
                      size="small"
                      type="primary"
                      style={{ marginRight: 6 }}
                      onClick={() => {
                        activateRotationPreview(r.id);
                        message.success("Rotation approved and activated.");
                        refresh();
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        rejectRotationPreview(r.id);
                        message.info("Rotation rejected.");
                        refresh();
                      }}
                    >
                      Reject
                    </Button>
                  </>
                );
              },
            },
          ]}
        />
      </div>
    </div>
  );
}
