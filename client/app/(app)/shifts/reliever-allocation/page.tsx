"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Select, Table, Tag } from "antd";
import { getSiteName, sites } from "@/lib/mock-data";
import { getRelievers } from "@/lib/reliever/pool";
import { getRelieverSuggestions } from "@/lib/shift";
import { nectarColors } from "@/lib/theme";

export default function RelieverAllocationPage() {
  const [siteId, setSiteId] = useState<string>();
  const rows = useMemo(() => getRelieverSuggestions(siteId), [siteId]);
  const allRelievers = getRelievers();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: 22,
          }}
        >
          Reliever allocation
        </div>
        <p style={{ margin: "6px 0 0", color: nectarColors.muted }}>
          Rotation → forecast manpower → detect gap → suggest pool reliever →
          avoid OT. Manage availability in{" "}
          <Link href="/reliever-pool">Reliever Pool</Link>.
        </p>
      </div>

      <Select
        allowClear
        placeholder="Site"
        style={{ maxWidth: 240 }}
        value={siteId}
        options={sites.map((s) => ({ value: s.id, label: s.name }))}
        onChange={setSiteId}
      />

      <Table
        rowKey={(r) => `${r.siteId}-${r.shiftId}`}
        dataSource={rows}
        style={{ background: nectarColors.white }}
        columns={[
          {
            title: "Site",
            dataIndex: "siteId",
            render: (id) => getSiteName(id),
          },
          {
            title: "Shift",
            dataIndex: "shiftCode",
            render: (c) => <Tag>{c}</Tag>,
          },
          { title: "Required", dataIndex: "required" },
          { title: "Available", dataIndex: "available" },
          {
            title: "Absent / gap",
            dataIndex: "absent",
            render: (n: number) => (
              <Tag color={n > 0 ? nectarColors.alert : nectarColors.mint}>
                {n}
              </Tag>
            ),
          },
          {
            title: "Suggested relievers",
            dataIndex: "suggestedRelieverIds",
            render: (ids: string[]) =>
              ids.length ? (
                ids.map((id) => {
                  const r = allRelievers.find((x) => x.id === id);
                  return (
                    <Tag key={id} color={nectarColors.leaf}>
                      {r?.name ?? id}
                    </Tag>
                  );
                })
              ) : (
                <span style={{ color: nectarColors.alert }}>
                  No pool match — OT risk
                </span>
              ),
          },
        ]}
      />
    </div>
  );
}
