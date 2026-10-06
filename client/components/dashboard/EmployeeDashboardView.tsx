"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, theme } from "antd";
import { PlusOutlined, WarningOutlined } from "@ant-design/icons";
import type { Employee } from "@/lib/types/employee.types";
import type { Site } from "@/lib/types/site.types";
import { getLeaveBalances, getLeaves, type LeaveBalances } from "@/lib/api/leaves";
import { getServerNotifications } from "@/lib/api/training";
import type { ServerNotification } from "@/lib/training/types";
import { getCertificatesForEmployee, getTrainingItems, useTrainingData } from "@/lib/training/store";
import { getOtAssignments } from "@/lib/overtime";
import { formatInrAmount, getSalaryHistory, salaryMonthLabel } from "@/lib/salary";
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS, type LeaveRequest, type LeaveStatus, type LeaveType } from "@/lib/leave/types";
import { Dot, Panel, Person, Quiet, Section } from "@/components/quiet";
import { tr, trTable, intlLocale, trData } from "@/lib/i18n";

const SHIFT_LABEL: Record<string, string> = trTable({
  "sh-morning": "Morning shift",
  "sh-evening": "Evening shift",
  "sh-night": "Night shift",
  "sh-general": "General shift",
});

const TRAINING_LABEL = trTable({ overdue: "Overdue", "due-soon": "Due soon", scheduled: "In progress", completed: "Completed" } as const);

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(), { dateStyle: "medium" });

/** A plain employee's own dashboard. Everything here is theirs and comes from the database unless noted. */
export default function EmployeeDashboardView({
  employee,
  site,
  reporting,
}: {
  employee: Employee;
  site?: Site;
  reporting: { manager?: Employee; sic?: Employee; supervisor?: Employee };
}) {
  const { token } = theme.useToken();
  const muted = { color: token.colorTextSecondary };

  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    return hour < 12 ? tr("Good morning") : hour < 17 ? tr("Good afternoon") : tr("Good evening");
  });

  // Leave balances, recent leave and notifications: database
  const [balances, setBalances] = useState<LeaveBalances | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[] | null>(null);
  const [notes, setNotes] = useState<ServerNotification[] | null>(null);
  useEffect(() => {
    let alive = true;
    getLeaveBalances(employee.id).then((b) => alive && setBalances(b)).catch(() => alive && setBalances({ employeeId: employee.id, balances: {} }));
    getLeaves({ employeeId: employee.id }).then((l) => alive && setLeaves(l)).catch(() => alive && setLeaves([]));
    getServerNotifications(employee.id).then((n) => alive && setNotes(n)).catch(() => alive && setNotes([]));
    return () => {
      alive = false;
    };
  }, [employee.id]);

  // Training and certificates: database (training store)
  const { ready: trainingReady, version } = useTrainingData();
  const trainings = useMemo(() => {
    void version;
    const rank = { overdue: 0, "due-soon": 1, scheduled: 2, completed: 3 } as const;
    return getTrainingItems({ employeeId: employee.id })
      .filter((t) => t.status !== "completed")
      .sort((a, b) => rank[a.status] - rank[b.status] || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  }, [employee.id, version]);
  const certs = useMemo(() => {
    void version;
    return getCertificatesForEmployee(employee.id);
  }, [employee.id, version]);

  // Overtime assignments are kept by the overtime module in this browser
  const ot = useMemo(
    () => getOtAssignments({ employeeId: employee.id }).filter((a) => a.status === "assigned" || a.status === "acknowledged"),
    [employee.id],
  );
  const salary = useMemo(() => getSalaryHistory(employee.id)[0], [employee.id]);

  const balanceRows = Object.entries(balances?.balances ?? {}).filter(([k]) => k !== "unpaid") as [LeaveType, number][];
  const recentLeave = [...(leaves ?? [])].sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))[0];
  const unread = (notes ?? []).filter((n) => !n.read).length;
  const trainingColor = (s: keyof typeof TRAINING_LABEL) =>
    s === "overdue" ? token.colorError : s === "due-soon" ? token.colorWarning : token.colorPrimary;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header data-anim="intro" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: token.colorText }}>
            {trData(greeting)}, {trData(employee.name).split(" ")[0]}
          </h2>
          <div style={{ marginTop: 4, fontSize: 14, ...muted }}>
            {[employee.designation, site?.name, employee.id.toUpperCase()].filter(Boolean).map((x) => trData(String(x))).join(" · ")}
          </div>
        </div>
        <div style={{ fontSize: 14, ...muted }}>{SHIFT_LABEL[employee.shiftId] ?? tr("Shift not set")}</div>
      </header>

      {ot.length ? (
        <div data-anim="intro">
          <Panel style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
                <WarningOutlined style={{ color: token.colorWarning, marginTop: 3 }} />
                <div style={{ lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 500 }}>
                    {tr("Overtime assigned · {hours} h on {date}", { hours: ot[0].hours, date: ot[0].date })}
                    {ot.length > 1 ? tr(" (+{count} more)", { count: ot.length - 1 }) : ""}
                  </div>
                  <div style={{ fontSize: 13, ...muted }}>
                    {trData(ot[0].reason)}
                    {ot[0].notes ? ` · ${trData(ot[0].notes)}` : ""}
                  </div>
                </div>
              </div>
              <Link href="/notifications"><Button size="small">{tr("Acknowledge")}</Button></Link>
            </div>
          </Panel>
        </div>
      ) : null}

      <div className="nectar-employee-grid">
        <Section title={tr("Your team")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(
              [
                [tr("Site Manager"), reporting.supervisor],
                [tr("Shift In-Charge"), reporting.sic],
                [tr("Plant Manager"), reporting.manager],
              ] as const
            ).map(([role, person]) =>
              person ? (
                <Link key={role} href={`/employees/${person.id}`} style={{ color: "inherit" }}>
                  <Person name={person.name} sub={trData(role)} />
                </Link>
              ) : (
                <div key={role} style={{ fontSize: 13, ...muted }}>
                  {tr("{role}: not assigned", { role: trData(role) })}
                </div>
              ),
            )}
          </div>
        </Section>

        <Section title={tr("Leave")} extra={<Link href="/leave/requests?mine=1">{tr("My requests")}</Link>}>
          {balances === null ? (
            <Quiet>{tr("Loading…")}</Quiet>
          ) : balanceRows.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 12 }}>
              {balanceRows.map(([type, days]) => (
                <div key={type}>
                  <div data-count={days} style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{days}</div>
                  <div style={{ fontSize: 12, ...muted }}>{tr("{type} left", { type: LEAVE_TYPE_LABELS[type] ?? type })}</div>
                </div>
              ))}
            </div>
          ) : (
            <Quiet>{tr("No leave balance on record.")}</Quiet>
          )}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${token.colorSplit}`, fontSize: 13 }}>
            {recentLeave ? (
              <Link href={`/leave/requests/${recentLeave.id}`} style={{ color: "inherit" }}>
                <span style={muted}>{tr("Latest:")}</span>
                {LEAVE_TYPE_LABELS[recentLeave.leaveType as LeaveType] ?? recentLeave.leaveType} · {recentLeave.startDate} → {recentLeave.endDate}
                <span style={muted}> · {LEAVE_STATUS_LABELS[recentLeave.status as LeaveStatus] ?? recentLeave.status}</span>
              </Link>
            ) : (
              <Quiet>{leaves === null ? tr("Loading…") : tr("No leave requests yet.")}</Quiet>
            )}
          </div>
          <Link href="/leave/requests?mine=1" style={{ display: "inline-block", marginTop: 12 }}>
            <Button icon={<PlusOutlined />}>{tr("Apply for leave")}</Button>
          </Link>
        </Section>

        <Section title={tr("Training")} extra={<Link href="/training">{tr("Training")}</Link>}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={muted}>{tr("Skill score")}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{employee.skillScore}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: token.colorFillSecondary, marginBottom: 14 }}>
            <div
              data-anim="bar"
              style={{
                width: `${employee.skillScore}%`,
                height: "100%",
                borderRadius: 2,
                background: employee.skillScore < 70 ? token.colorWarning : token.colorPrimary,
              }}
            />
          </div>
          {trainings.length ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {trainings.slice(0, 3).map((t, i) => (
                <li key={t.id} style={{ padding: "8px 0", borderTop: i ? `1px solid ${token.colorSplit}` : undefined, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ minWidth: 0, color: token.colorText }}>{trData(t.course)}</span>
                    <Dot color={trainingColor(t.status)} label={TRAINING_LABEL[t.status]} />
                  </div>
                  {t.dueDate ? <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{tr("Due {dueDate}", { dueDate: t.dueDate })}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <Quiet>{trainingReady ? tr("No open training. You're up to date.") : tr("Loading…")}</Quiet>
          )}
        </Section>

        <Section title={tr("Certificates")} extra={<Link href="/certifications?mine=1">{tr("All")}</Link>}>
          {certs.length ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {certs.slice(0, 4).map((c, i) => (
                <li
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 0",
                    borderTop: i ? `1px solid ${token.colorSplit}` : undefined,
                    fontSize: 13,
                  }}
                >
                  <span style={{ minWidth: 0 }}>{trData(c.name)}</span>
                  <span style={{ flexShrink: 0, ...muted }}>{c.expiresOn ? tr("Expires {expiresOn}", { expiresOn: trData(c.expiresOn) }) : tr("No expiry")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Quiet>{trainingReady ? tr("No certificates yet.") : tr("Loading…")}</Quiet>
          )}
        </Section>

        <Section title={tr("Notifications")} extra={<Link href="/notifications">{unread ? tr("{unread} unread", { unread }) : tr("All")}</Link>}>
          {notes === null ? (
            <Quiet>{tr("Loading…")}</Quiet>
          ) : notes.length ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {notes.slice(0, 4).map((n, i) => (
                <li key={n.id} style={{ padding: "8px 0", borderTop: i ? `1px solid ${token.colorSplit}` : undefined, fontSize: 13 }}>
                  <Link href={n.href ?? "/notifications"} style={{ color: "inherit", display: "block" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      {!n.read ? <span aria-label={tr("Unread")} style={{ width: 6, height: 6, borderRadius: "50%", background: token.colorPrimary, flex: "none", transform: "translateY(-1px)" }} /> : null}
                      <span style={{ fontWeight: n.read ? 400 : 500 }}>{trData(n.title)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{fmtDate(n.createdAt)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Quiet>{tr("No notifications.")}</Quiet>
          )}
        </Section>

        <Section title={tr("Latest salary")} extra={<Link href="/salary">{tr("Payslips")}</Link>}>
          {salary ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{formatInrAmount(salary.amount)}</div>
              <div style={{ fontSize: 13, marginTop: 2, ...muted }}>
                {tr("{salaryMonthLabel} · {paymentMode} on {paymentDate}", { salaryMonthLabel: salaryMonthLabel(salary.salaryMonth), paymentMode: trData(salary.paymentMode), paymentDate: salary.paymentDate })}
              </div>
              <div style={{ fontSize: 13, marginTop: 10, ...muted }}>
                {trData(salary.bankName)} ••••{trData(salary.accountLast4)}
              </div>
            </>
          ) : (
            <Quiet>{tr("No salary records.")}</Quiet>
          )}
        </Section>
      </div>
    </div>
  );
}
