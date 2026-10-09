"use client";

import Link from "next/link";
import { theme } from "antd";
import { getSession } from "@/lib/auth";
import { getUrgentTrainingItems, useTrainingData } from "@/lib/training";
import { scopedSiteId } from "@/lib/rbac";
import { Dot, Quiet, Section } from "@/components/quiet";
import {
  translateCourseTitle,
  translatePersonName,
  translateSiteName,
  useT,
} from "@/lib/i18n";

/** Overdue and soon-due training from the training records (database), most urgent first. */
export default function UrgentTrainingList() {
  const { token } = theme.useToken();
  const t = useT();
  const { ready, version } = useTrainingData();
  void version;
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const all = getUrgentTrainingItems(siteScope);
  const items = all.slice(0, 6);

  return (
    <Section
      title={t("dash.urgentTraining")}
      extra={all.length > items.length ? `${items.length} ${t("dash.of")} ${all.length}` : undefined}
      flush
    >
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
                  {translatePersonName(item.employeeName)}
                </Link>
                <div style={{ fontSize: 13, color: token.colorTextSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {translateCourseTitle(item.course)} · {translateSiteName(item.siteName)}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, lineHeight: 1.35, fontSize: 13 }}>
                <Dot
                  color={item.status === "overdue" ? token.colorError : token.colorWarning}
                  label={item.status === "overdue" ? t("dash.overdue") : t("dash.dueSoon")}
                />
                <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{item.dueDate}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ padding: 16 }}>
          <Quiet>{ready ? t("dash.nothingUrgent") : t("app.loading")}</Quiet>
        </div>
      )}
    </Section>
  );
}
