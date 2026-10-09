"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Avatar, Button, Empty, Result, Skeleton } from "antd";
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  MailOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  UploadOutlined,
  LinkedinFilled,
  LinkOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { getEmployeeById as fetchEmployee } from "@/lib/api/employees";
import { getSiteById as fetchSite } from "@/lib/api/sites";
import { getLeaveBalances, getLeaves } from "@/lib/api/leaves";
import { getSession } from "@/lib/auth";
import { canAccessEmployeeRecord, canViewOtModule, scopedEmployeeId } from "@/lib/rbac";
import { useAsync } from "@/lib/training/hooks";
import { getCertificates, getCourseById, useTrainingData } from "@/lib/training/store";
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS, type LeaveStatus, type LeaveType } from "@/lib/leave/types";
import type { Employee } from "@/lib/types/employee.types";
import EmployeeTrainingSection from "@/components/training/records/EmployeeTrainingSection";
import { tr, trTable, translatePersonName, intlLocale, trData } from "@/lib/i18n";

const CARD = "bg-white border border-slate-200 rounded-3xl p-5 sm:p-6";
const H2 = "m-0 text-lg font-bold text-slate-900";

const CATEGORY_LABEL: Record<string, string> = trTable({
  shift: "Shift employee",
  general: "General shift",
  supervisor: "Site Manager",
  shift_incharge: "Shift In-Charge",
  manager: "Plant Manager",
  hr: "HR",
  director: "Director",
});
const SHIFT_LABEL: Record<string, string> = trTable({ "sh-morning": "Morning", "sh-evening": "Evening", "sh-night": "Night", "sh-general": "General" });
const title = (s?: string) => (s ? s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Whole years and months since an ISO date. */
function tenure(iso?: string) {
  if (!iso) return undefined;
  const from = new Date(iso);
  const now = new Date();
  let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth());
  if (now.getDate() < from.getDate()) months--;
  if (months < 0) return undefined;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && tr("{y} yr", { y: y }), m && tr("{m} mo", { m: m })].filter(Boolean).join(" ") || tr("Less than a month");
}

const LEAVE_TONE: Partial<Record<LeaveStatus, string>> = {
  CLOSED: "bg-slate-100 text-slate-600",
  APPROVED: "bg-emerald-50 text-emerald-700",
  HR_VALIDATED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="w-8 h-8 shrink-0 rounded-xl bg-[#1C4463]/[0.07] text-[#1C4463] flex items-center justify-center">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{trData(label)}</div>
        <div className="text-sm font-semibold text-slate-900 break-words">{children}</div>
      </div>
    </div>
  );
}

/** One person in the reporting line, from the database. */
function Person({ id, role }: { id?: string; role: string }) {
  const p = useAsync(() => (id ? fetchEmployee(id) : Promise.resolve(null)), [id]);
  if (!id) return null;
  return (
    <li className="relative pl-12 pb-4 last:pb-0">
      <span className="absolute left-[19px] top-10 bottom-0 w-px bg-slate-200" aria-hidden />
      <Link href={`/employees/${id}`} className="group flex items-center gap-3 -ml-12">
        <Avatar size={40} className="bg-[#1C4463]! shrink-0">{p.data ? initials(p.data.name) : "…"}</Avatar>
        <span className="min-w-0">
          <span className="block text-xs text-slate-500">{trData(role)}</span>
          <span className="block text-sm font-semibold text-slate-900 truncate group-hover:underline">{p.data?.name ? trData(p.data.name) : p.loading ? tr("Loading…") : id}</span>
        </span>
      </Link>
    </li>
  );
}

/** Employee profile (also "My Profile"): everything here is read from the database. */
export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: routeId } = use(params);
  const router = useRouter();
  const { message } = App.useApp();
  const session = getSession();
  const selfId = scopedEmployeeId(session);
  const id = selfId && selfId !== routeId ? selfId : routeId;
  const isSelf = session?.employeeId === id;
  useTrainingData(); // certificates + course titles
  const [now] = useState(() => Date.now());

  // Employees may only open their own profile
  useEffect(() => {
    if (selfId && selfId !== routeId) router.replace(`/employees/${selfId}`);
  }, [selfId, routeId, router]);

  const employee = useAsync(() => fetchEmployee(id), [id]);
  const e = employee.data as Employee | undefined;
  const site = useAsync(() => (e?.siteId ? fetchSite(e.siteId) : Promise.resolve(null)), [e?.siteId]);
  const balances = useAsync(() => getLeaveBalances(id), [id]);
  const leaves = useAsync(() => getLeaves({ employeeId: id }), [id]);

  useEffect(() => {
    if (e && !selfId && !canAccessEmployeeRecord(session, e as never)) router.replace("/employees");
  }, [e, session, selfId, router]);

  if (employee.loading && !e) return <Skeleton active avatar style={{ padding: 24 }} />;
  if (!e) {
    return (
      <Result
        status="404"
        title={tr("Employee not found")}
        subTitle={employee.error ?? undefined}
        extra={<Button type="primary" onClick={() => router.push("/employees")}>{tr("Back to employees")}</Button>}
      />
    );
  }

  const certs = getCertificates(id);
  const validCerts = certs.filter((c) => !c.expiresAt || Date.parse(c.expiresAt) > now);
  const leaveList = [...(leaves.data ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const balanceEntries = Object.entries(balances.data?.balances ?? {}).filter(([k]) => k !== "unpaid") as [LeaveType, number][];
  const paidLeft = balanceEntries.reduce((s, [, n]) => s + n, 0);

  const stats: [string, ReactNode][] = [
    [tr("With Nectar"), tenure(e.joinedAt) ?? "—"],
    [tr("Experience"), e.yearsExperience ? tr("{yearsExperience} yr", { yearsExperience: e.yearsExperience }) : "—"],
    [tr("Skill score"), `${e.skillScore ?? 0}%`],
    [tr("Valid certificates"), validCerts.length],
    [tr("Paid leave left"), balances.data ? tr("{paidLeft} days", { paidLeft: paidLeft }) : "—"],
  ];

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {!isSelf && (
        <button
          type="button"
          onClick={() => router.push("/employees")}
          className="self-start inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 bg-transparent cursor-pointer"
        >
          <ArrowLeftOutlined />{" "}{tr("Employees")}
        </button>
      )}

      {/* Header */}
      <header className="rounded-3xl overflow-hidden bg-white border border-slate-200">
        <div className="px-5 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0">
            <div className="w-full h-full rounded-3xl bg-[#1C4463] text-white text-3xl font-extrabold flex items-center justify-center">
              {trData(initials(e.name))}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="m-0 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{trData(e.name)}</h1>
              {isSelf && <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1C4463] text-white">{tr("You")}</span>}
            </div>
            <p className="m-0 mt-1 text-slate-600">
              {trData(e.designation)}
              {site.data ? ` · ${trData(site.data.name)}` : ""}
            </p>
            <div className="flex gap-2 flex-wrap mt-3">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${e.employmentStatus === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {e.employmentStatus === "active" ? tr("Active") : tr("Inactive")}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{CATEGORY_LABEL[e.employeeCategory] ?? title(e.employeeCategory)}</span>
              {e.employeeType && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{trData(title(e.employeeType))}</span>}
              {e.otEligible && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700">{tr("OT eligible")}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {e.email && (
              <a href={`mailto:${e.email}`} aria-label={tr("Email")} className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 bg-white! text-slate-700! hover:border-[#1C4463] hover:text-[#1C4463]!">
                <MailOutlined />
              </a>
            )}
            {e.phone && (
              <a href={`tel:${e.phone.replace(/\s/g, "")}`} aria-label={tr("Call")} className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 bg-white! text-slate-700! hover:border-[#1C4463] hover:text-[#1C4463]!">
                <PhoneOutlined />
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 border-t border-slate-100">
          {stats.map(([label, value]) => (
            <div key={label} className="px-5 sm:px-6 py-4 border-slate-100 [&:not(:last-child)]:sm:border-r">
              <div className="text-xl font-extrabold text-slate-900">{value}</div>
              <div className="text-xs text-slate-500">{trData(label)}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
        {/* Left: details */}
        <aside className="flex flex-col gap-6">
          <section className={CARD} aria-label={tr("Details")}>
            <h2 className={H2}>{tr("Details")}</h2>
            <div className="mt-2 divide-y divide-slate-100">
              <Fact icon={<IdcardOutlined />} label={tr("Employee ID")}>{e.id}</Fact>
              <Fact icon={<MedicineBoxOutlined />} label={tr("Mediclaim ID")}>
                <span className="inline-flex items-center gap-2 font-normal text-slate-400">
                  {tr("Not added yet")}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">{tr("Coming soon")}</span>
                </span>
              </Fact>
              <Fact icon={<MailOutlined />} label={tr("Email")}>{e.email || "—"}</Fact>
              <Fact icon={<PhoneOutlined />} label={tr("Phone")}>{e.phone || "—"}</Fact>
              <Fact icon={<TeamOutlined />} label={tr("Department")}>{e.department ? trData(e.department) : "—"}</Fact>
              <Fact icon={<ClockCircleOutlined />} label={tr("Shift")}>{SHIFT_LABEL[e.shiftId] ?? title(e.shiftId)}</Fact>
              <Fact icon={<CalendarOutlined />} label={tr("Joined")}>
                {e.joinedAt ? new Date(e.joinedAt).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" }) : "—"}
              </Fact>
            </div>
          </section>

          <section className={CARD} aria-label={tr("LinkedIn")}>
            <div className="flex items-center gap-2">
              <h2 className={H2}>{tr("LinkedIn")}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">{tr("Coming soon")}</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="w-11 h-11 shrink-0 rounded-xl bg-[#0A66C2] text-white text-xl flex items-center justify-center">
                <LinkedinFilled />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-700">{tr("Not linked")}</div>
                <div className="text-xs text-slate-500">
                  {isSelf ? tr("Link your LinkedIn profile to show it here.") : tr("No LinkedIn profile linked.")}
                </div>
              </div>
            </div>
            {isSelf && (
              <Button
                block
                icon={<LinkOutlined />}
                onClick={() => message.info(tr("LinkedIn linking — coming soon. This feature is under development."))}
                className="mt-4 rounded-xl!"
              >
                {tr("Link LinkedIn profile")}
              </Button>
            )}
          </section>

          <section className={CARD} aria-label={tr("Site")}>
            <h2 className={H2}>{tr("Site")}</h2>
            {site.data ? (
              <Link href={`/sites`} className="mt-3 flex items-center gap-3 rounded-2xl bg-slate-50! border border-slate-100 p-4 hover:border-[#1C4463]">
                <span className="w-11 h-11 shrink-0 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center text-sm">{trData(site.data.plantType)}</span>
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900">{trData(site.data.name)}</span>
                  <span className="block text-xs text-slate-500"><EnvironmentOutlined /> {trData(site.data.location)}</span>
                </span>
              </Link>
            ) : (
              <p className="m-0 mt-2 text-sm text-slate-500">{e.siteId ? tr("Loading…") : tr("Corporate (all sites)")}</p>
            )}
          </section>

          <section className={CARD} aria-label={tr("Reporting line")}>
            <h2 className={H2}>{tr("Reporting line")}</h2>
            {e.managerId || e.supervisorId || e.shiftInChargeId ? (
              <ol className="m-0 p-0 list-none mt-4">
                <Person id={e.managerId} role="Plant Manager" />
                {e.supervisorId !== e.managerId && <Person id={e.supervisorId} role="Site Manager" />}
                {e.shiftInChargeId !== e.supervisorId && e.shiftInChargeId !== e.managerId && <Person id={e.shiftInChargeId} role="Shift In-Charge" />}
              </ol>
            ) : (
              <p className="m-0 mt-2 text-sm text-slate-500">{isSelf ? tr("No one is set above you.") : tr("No one is set above {name}.", { name: translatePersonName(e.name).split(" ")[0] })}</p>
            )}
          </section>
        </aside>

        {/* Right: leave, certificates, training */}
        <main className="flex flex-col gap-6 min-w-0">
          <section className={CARD} aria-label={tr("Leave")}>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className={H2}>{tr("Leave")}</h2>
              {isSelf && (
                <Link href="/leave/requests" className="text-sm font-semibold text-emerald-700!">
                  {tr("Apply for leave")}{" "}<RightOutlined className="text-xs" />
                </Link>
              )}
            </div>
            {balances.loading && !balances.data ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : balanceEntries.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {balanceEntries.map(([type, days]) => (
                  <div key={type} className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                    <div className="text-2xl font-extrabold text-slate-900">{days}</div>
                    <div className="text-xs text-slate-500">{tr("{type} left", { type: LEAVE_TYPE_LABELS[type] ?? title(type) })}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 mt-2 text-sm text-slate-500">{tr("No leave balance on record.")}</p>
            )}

            <div className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">{tr("Recent requests")}</div>
            {leaves.loading && !leaves.data ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : leaveList.length === 0 ? (
              <p className="m-0 mt-2 text-sm text-slate-500">{tr("No leave requests yet.")}</p>
            ) : (
              <ul className="m-0 p-0 list-none mt-2 divide-y divide-slate-100">
                {leaveList.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    <Link href={`/leave/requests/${l.id}`} className="group flex items-center gap-3 py-3">
                      <span className="w-11 h-11 shrink-0 rounded-xl bg-[#1C4463]/[0.07] text-[#1C4463] flex flex-col items-center justify-center leading-none">
                        <span className="text-[10px] font-semibold uppercase">{new Date(l.startDate).toLocaleDateString(intlLocale(), { month: "short" })}</span>
                        <span className="text-base font-extrabold">{new Date(l.startDate).getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 group-hover:underline">
                          {tr("{type} leave", { type: LEAVE_TYPE_LABELS[l.leaveType as LeaveType] ?? title(l.leaveType) })}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {l.startDate}
                          {l.endDate && l.endDate !== l.startDate ? ` → ${l.endDate}` : ""}
                        </span>
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${LEAVE_TONE[l.status as LeaveStatus] ?? "bg-amber-50 text-amber-700"}`}>
                        {LEAVE_STATUS_LABELS[l.status as LeaveStatus] ?? title(l.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={CARD} aria-label={isSelf ? tr("My resume") : tr("Resume")}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h2 className={H2}>{isSelf ? tr("My resume") : tr("Resume")}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">{tr("Coming soon")}</span>
              </div>
              {isSelf && (
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => message.info(tr("Resume upload — coming soon. This feature is under development."))}
                  className="rounded-xl!"
                >
                  {tr("Upload resume")}
                </Button>
              )}
            </div>
            <div className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-5 py-6">
              <span className="w-12 h-12 shrink-0 rounded-2xl bg-white border border-slate-200 text-slate-400 text-xl flex items-center justify-center">
                <FileTextOutlined />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-700">{tr("No resume uploaded")}</div>
                <div className="text-xs text-slate-500">
                  {isSelf ? tr("You'll be able to upload a PDF or Word resume here soon.") : tr("Resumes will appear here once uploading is available.")}
                </div>
              </div>
            </div>
          </section>

          <section className={CARD} aria-label={tr("Certificates")}>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className={H2}>{tr("Certificates")}{" "}<span className="font-normal text-slate-400">{certs.length}</span></h2>
              <Link href={isSelf ? "/certifications?mine=1" : "/certifications"} className="text-sm font-semibold text-emerald-700!">
                {tr("See all")}{" "}<RightOutlined className="text-xs" />
              </Link>
            </div>
            {certs.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tr("No certificates yet")} />
            ) : (
              <ul className="m-0 p-0 list-none mt-4 grid gap-3 sm:grid-cols-2">
                {certs.map((c) => {
                  const valid = !c.expiresAt || Date.parse(c.expiresAt) > now;
                  const course = getCourseById(c.courseId);
                  return (
                    <li key={c.id} className="rounded-2xl border border-slate-200 p-4 flex gap-3">
                      <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg ${valid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                        <SafetyCertificateOutlined />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{course?.title ?? c.courseTitle}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {course?.code ? `${course.code} · ` : ""}
                          {valid ? tr("Valid until {expiresAt}", { expiresAt: c.expiresAt?.slice(0, 10) ?? "—" }) : tr("Expired {expiresAt}", { expiresAt: c.expiresAt?.slice(0, 10) })}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={CARD} aria-label={tr("Training")}>
            <EmployeeTrainingSection employeeId={e.id} />
          </section>

          {canViewOtModule(session) && (
            <Link
              href={`/overtime/employees/${e.id}`}
              className={`${CARD} flex items-center justify-between gap-3 hover:border-[#1C4463]`}
            >
              <span>
                <span className="block font-bold text-slate-900">{tr("Overtime")}</span>
                <span className="block text-sm text-slate-500">{tr("Open the overtime module for this person's OT history")}</span>
              </span>
              <RightOutlined className="text-slate-400" />
            </Link>
          )}
        </main>
      </div>
    </div>
  );
}
