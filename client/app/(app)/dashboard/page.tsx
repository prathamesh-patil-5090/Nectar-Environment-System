"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Spin, theme } from "antd";
import SkillHeatmap from "@/components/SkillHeatmap";
import UrgentTrainingList from "@/components/UrgentTrainingList";
import SiteReadiness from "@/components/SiteReadiness";
import SafetySummaryPanel from "@/components/safety/SafetySummaryPanel";
import EmployeeDashboardView from "@/components/dashboard/EmployeeDashboardView";
import { NumberRow } from "@/components/quiet";
import { getSession } from "@/lib/auth";
import { getEmployeeById, getEmployees } from "@/lib/api/employees";
import { getSites } from "@/lib/api/sites";
import type { Employee } from "@/lib/types/employee.types";
import type { Site } from "@/lib/types/site.types";
import { normalizeRole, roleLabel, scopedSiteId, selfEmployeeId } from "@/lib/rbac";
import { getUrgentTrainingItems, useTrainingData } from "@/lib/training";
import { READINESS_READY_THRESHOLD, countComplianceReadySites } from "@/lib/workforce-metrics";
import { useDashboardMotion } from "@/lib/motion/use-dashboard-motion";
import { translatePersonName, useT, trData } from "@/lib/i18n";

type Reporting = { manager?: Employee; sic?: Employee; supervisor?: Employee };

export default function DashboardPage() {
  const { token } = theme.useToken();
  const t = useT();
  const session = getSession();
  const siteScope = scopedSiteId(session);
  const role = normalizeRole(session?.role);
  const empId = selfEmployeeId(session);
  const isEmployee = role === "employee";
  const router = useRouter();

  // Heads of Department are not plant staff — their home is the E-Permits inbox.
  useEffect(() => {
    if (role === "hod") router.replace("/e-permits");
  }, [role, router]);

  const [roster, setRoster] = useState<Employee[] | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [me, setMe] = useState<Employee | null>(null);
  const [reporting, setReporting] = useState<Reporting>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getEmployees(siteScope), getSites()])
      .then(([emps, siteList]) => {
        if (!alive) return;
        setRoster(emps);
        setSites(siteList);
      })
      .catch((err: Error) => alive && setError(trData(err.message)));
    return () => {
      alive = false;
    };
  }, [siteScope]);

  useEffect(() => {
    if (!empId) return;
    let alive = true;
    getEmployeeById(empId)
      .then(async (e) => {
        if (!alive) return;
        setMe(e);
        const get = (id?: string) => (id ? getEmployeeById(id).catch(() => undefined) : Promise.resolve(undefined));
        const [manager, sic, supervisor] = await Promise.all([get(e.managerId), get(e.shiftInChargeId), get(e.supervisorId)]);
        if (alive) setReporting({ manager, sic, supervisor });
      })
      .catch((err: Error) => alive && setError(trData(err.message)));
    return () => {
      alive = false;
    };
  }, [empId]);

  const { version: trainingVersion } = useTrainingData();
  const urgentTraining = useMemo(() => {
    void trainingVersion;
    return getUrgentTrainingItems(siteScope).length;
  }, [siteScope, trainingVersion]);

  const active = (roster ?? []).filter((e) => e.employmentStatus === "active");
  const skillCoverage = active.length ? Math.round(active.reduce((s, e) => s + e.skillScore, 0) / active.length) : 0;
  const plants = sites.filter((s) => (s.status ?? "operational") === "operational" && (!siteScope || s.id === siteScope));
  const readySites = countComplianceReadySites(siteScope);
  const site = sites.find((s) => s.id === (me?.siteId ?? siteScope));

  const ready = isEmployee ? Boolean(me) : roster !== null;
  const pageRef = useDashboardMotion(ready);

  const plantName = siteScope
    ? (trData(sites.find((s) => s.id === siteScope)?.name) || t("dash.yourPlant"))
    : null;
  const subtitle =
    role === "director" || !siteScope
      ? t("dash.acrossAllPlants")
      : `${plantName}.`;

  if (error && !roster && !me) {
    return <Alert type="error" showIcon title={t("dash.loadError")} description={trData(error)} />;
  }
  if (!ready) {
    return <div style={{ padding: 48, textAlign: "center" }}><Spin /></div>;
  }

  if (isEmployee && me) {
    return (
      <div ref={pageRef}>
        <EmployeeDashboardView employee={me} site={site} reporting={reporting} />
      </div>
    );
  }

  return (
    <div ref={pageRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p data-anim="intro" style={{ margin: 0, fontSize: 14, color: token.colorTextSecondary }}>
        {trData(subtitle)}{" "}
        {t("dash.signedInAs", { role: roleLabel(session?.role) })}
        {me ? ` · ${translatePersonName(me.name)}` : ""}.
      </p>

      <div data-anim="intro">
        <NumberRow
          items={[
            {
              label: t("dash.employees"),
              value: active.length,
              hint: siteScope ? t("dash.onThisPlant") : t("dash.acrossAllPlantsHint"),
            },
            {
              label: t("dash.runningPlants"),
              value: plants.length,
              hint: plants.map((p) => p.location.split(",")[0]).join(" · ") || undefined,
            },
            {
              label: t("dash.avgSkill"),
              value: `${skillCoverage}%`,
              hint: t("dash.activeEmployees"),
            },
            {
              label: t("dash.urgentTraining"),
              value: urgentTraining,
              hint: t("dash.urgentHint"),
              alert: urgentTraining > 0,
            },
            {
              label: t("dash.readyPlants"),
              value: `${readySites} ${t("dash.of")} ${plants.length}`,
              hint: t("dash.readinessHint", { n: READINESS_READY_THRESHOLD }),
              alert: readySites < plants.length,
            },
          ]}
        />
      </div>

      <div data-anim="intro">
        <SafetySummaryPanel siteId={siteScope} />
      </div>

      <div className="nectar-dash-grid">
        <UrgentTrainingList />
        <SiteReadiness sites={plants} />
      </div>

      <div data-anim="intro">
        <SkillHeatmap />
      </div>
    </div>
  );
}
