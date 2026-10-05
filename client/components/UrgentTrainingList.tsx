"use client";

import Link from "next/link";
import { theme } from "antd";
import { getSession } from "@/lib/auth";
import { getUrgentTrainingItems, useTrainingData } from "@/lib/training";
import { scopedSiteId } from "@/lib/rbac";
import { Dot, Quiet, Section } from "@/components/quiet";

/** Overdue and soon-due training from the training records (database), most urgent first. */
export default function UrgentTrainingList() {
  const { token } = theme.useToken();
  const { ready, version } = useTrainingData();
  void version; // re-render when training data reloads
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const all = getUrgentTrainingItems(siteScope);
  const items = all.slice(0, 6);

  return (
    <Section title="Urgent training" extra={all.length > items.length ? `${items.length} of ${all.length}` : undefined} flush>
      {items.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item, i) => (
            <li
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                borderTop: i ? `1px solid ${token.colorSplit}` : undefined,
              }}
            >
              <div style={{ minWidth: 0, lineHeight: 1.35 }}>
                <Link href={`/employees/${item.employeeId}`} style={{ fontWeight: 500, color: token.colorText }}>
                  {item.employeeName}
                </Link>
                <div style={{ fontSize: 13, color: token.colorTextSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.course} · {item.siteName}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, lineHeight: 1.35, fontSize: 13 }}>
                <Dot
                  color={item.status === "overdue" ? token.colorError : token.colorWarning}
                  label={item.status === "overdue" ? "Overdue" : "Due soon"}
                />
                <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{item.dueDate}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ padding: 16 }}>
          <Quiet>{ready ? "Nothing overdue or due in the next two weeks." : "Loading…"}</Quiet>
        </div>
      )}
    </Section>
  );
}
