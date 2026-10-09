"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, Input, Select, Table, theme } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { getSession } from "@/lib/auth";
import { canViewEmployeeRoster, isInChargeOf, scopedSiteId } from "@/lib/rbac";
import { getEmployees } from "@/lib/api/employees";
import { getSites } from "@/lib/api/sites";
import type { Employee } from "@/lib/types/employee.types";
import type { Site } from "@/lib/types/site.types";
import { useTableMotion } from "@/lib/motion/use-table-motion";
import { translateDepartment, translateDesignation, translatePersonName, translateSiteName, useI18n, useT, trData } from "@/lib/i18n";

type TrainingStatus = Employee["trainingStatus"];

/** Below this the skill score is flagged — same cut-off the page used before. */
const SKILL_FLAG = 70;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export default function EmployeesPage() {
  const { token } = theme.useToken();
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const session = getSession();
  const siteScope = scopedSiteId(session);

  const TRAINING_LABEL: Record<TrainingStatus, string> = {
    compliant: t("employeesUi.compliant"),
    "due-soon": t("employeesUi.dueSoon"),
    overdue: t("employeesUi.overdue"),
  };

  const TYPE_LABEL: Record<Employee["employeeType"], string> = {
    permanent: t("employeesUi.permanent"),
    contract: t("employeesUi.contract"),
    deputed: t("employeesUi.deputed"),
  };

  // Roster and plant names both come from the DB.
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState<string | undefined>(undefined);

  // Plain employees have no roster — send them to their own profile.
  const hasRoster = canViewEmployeeRoster(session);
  useEffect(() => {
    if (!hasRoster && session?.employeeId) router.replace(`/employees/${session.employeeId}`);
  }, [hasRoster, session?.employeeId, router]);

  useEffect(() => {
    if (!hasRoster) return;
    Promise.all([getEmployees(siteScope), getSites()])
      .then(([emps, siteList]) => {
        setEmployees(emps);
        setSites(siteList);
      })
      .catch((err: Error) => setError(trData(err.message)));
  }, [siteScope, hasRoster]);

  const siteName = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  // Only the people in your charge: never yourself, never someone senior to you.
  const visible = useMemo(
    () => (employees ?? []).filter((e) => isInChargeOf(session, e)),
    // session is read from storage on each render; the roster only changes when employees load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees],
  );

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visible
      .filter((e) => !siteFilter || e.siteId === siteFilter)
      .filter(
        (e) =>
          !q ||
          [e.name, e.id, e.email, e.designation, e.department].some((v) => v?.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [visible, siteFilter, query, locale]);

  const { pageRef, tableRef } = useTableMotion(
    employees ? `${locale}|${data.map((e) => e.id).join("|")}` : "",
  );

  const trainingColor: Record<TrainingStatus, string> = {
    compliant: token.colorSuccess,
    "due-soon": token.colorWarning,
    overdue: token.colorError,
  };

  const muted = { color: token.colorTextSecondary };
  const empty = <span style={{ color: token.colorTextQuaternary }}>—</span>;

  const columns: ColumnsType<Employee> = [
    {
      title: t("common.employee"),
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, e) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              flex: "none",
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 600,
              color: token.colorTextSecondary,
              background: token.colorFillSecondary,
            }}
          >
            {trData(initials(name))}
          </span>
          <div style={{ lineHeight: 1.35, minWidth: 0 }}>
            <div style={{ fontWeight: 500, color: token.colorText }}>{translatePersonName(name)}</div>
            <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...muted }}>
              {e.id.toUpperCase()} · {e.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: t("employeesUi.designation"),
      dataIndex: "designation",
      key: "designation",
      filters: [...new Set(visible.map((e) => e.designation))]
        .sort()
        .map((d) => ({ text: translateDesignation(d), value: d })),
      onFilter: (value, e) => e.designation === value,
      render: (designation: string, e) => (
        <div style={{ lineHeight: 1.35 }}>
          <div>{translateDesignation(designation || e.role)}</div>
          <div style={{ fontSize: 13, ...muted }}>{translateDepartment(e.department)}</div>
        </div>
      ),
    },
    ...(siteScope
      ? []
      : [
          {
            title: t("common.site"),
            key: "site",
            render: (_: unknown, e: Employee) =>
              e.siteId
                ? translateSiteName(siteName.get(e.siteId) ?? e.siteId)
                : t("employeesUi.headOffice"),
          } satisfies ColumnsType<Employee>[number],
        ]),
    {
      title: t("employeesUi.type"),
      dataIndex: "employeeType",
      key: "employeeType",
      filters: (Object.keys(TYPE_LABEL) as Employee["employeeType"][]).map((k) => ({
        text: TYPE_LABEL[k],
        value: k,
      })),
      onFilter: (value, e) => e.employeeType === value,
      render: (type: Employee["employeeType"]) => (type ? TYPE_LABEL[type] : empty),
    },
    {
      title: t("employeesUi.skillScore"),
      dataIndex: "skillScore",
      key: "skillScore",
      width: 180,
      sorter: (a, b) => a.skillScore - b.skillScore,
      render: (score: number) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: token.colorFillSecondary }}>
            <div
              data-anim="bar"
              style={{
                width: `${score}%`,
                height: "100%",
                borderRadius: 2,
                background: score < SKILL_FLAG ? token.colorWarning : token.colorPrimary,
              }}
            />
          </div>
          <span style={{ width: 36, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{score}%</span>
        </div>
      ),
    },
    {
      title: t("employeesUi.training"),
      dataIndex: "trainingStatus",
      key: "trainingStatus",
      filters: (Object.keys(TRAINING_LABEL) as TrainingStatus[]).map((s) => ({
        text: TRAINING_LABEL[s],
        value: s,
      })),
      onFilter: (value, e) => e.trainingStatus === value,
      render: (status: TrainingStatus) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: trainingColor[status] }} />
          {TRAINING_LABEL[status]}
        </span>
      ),
    },
  ];

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        data-anim="intro"
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <p style={{ margin: 0, fontSize: 14, maxWidth: 560, ...muted }}>
          {siteScope
            ? t("employeesUi.plantRoster", { site: trData(siteName.get(siteScope)) || t("dash.yourPlant") })
            : t("employeesUi.allRoster")}{" "}
          {t("employeesUi.openRow")}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
            placeholder={t("employeesUi.search")}
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            style={{ width: 300, maxWidth: "100%" }}
          />
          {siteScope ? null : (
            <Select
              allowClear
              placeholder={t("employeesUi.allSites")}
              value={siteFilter}
              onChange={setSiteFilter}
              options={sites.map((s) => ({
            value: s.id,
            label: translateSiteName(s.name),
          }))}
              style={{ width: 220, maxWidth: "100%" }}
            />
          )}
        </div>
      </div>

      {error ? <Alert type="error" showIcon message={t("employeesUi.loadError")} description={trData(error)} /> : null}

      <div
        ref={tableRef}
        data-anim="intro"
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          overflow: "hidden",
          background: token.colorBgContainer,
        }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={!employees && !error}
          scroll={{ x: 960 }}
          pagination={{
            pageSize: 10,
            hideOnSinglePage: true,
            showSizeChanger: false,
            showTotal: (total, [from, to]) =>
              t("employeesUi.showTotal", { from, to, total }),
            style: { padding: "0 16px" },
          }}
          onRow={(e) => ({
            onClick: () => router.push(`/employees/${e.id}`),
            style: { cursor: "pointer" },
          })}
        />
      </div>
    </div>
  );
}
