"use client";

import { useMemo, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Drawer,
  Input,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Alert,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { getSession } from "@/lib/auth";
import { getEmployeeById, getSiteName, sites } from "@/lib/mock-data";
import {
  ACTIVE_PATTERN,
  EFFECTIVE,
  adminDecideRotation,
  buildMonthScheduleAssignments,
  getRotationPreviews,
  getRotationRows,
  getShiftByCode,
  hasPublishedMonth,
  managerDecideRotation,
  markRotationScheduleViewed,
  monthBounds,
  rotationPatterns,
  submitMonthlyScheduleDraft,
  validateScheduleAssignments,
  type RotationAssignmentCell,
  type RotationPatternId,
  type RotationPreview,
  type ShiftCode,
} from "@/lib/shift";
import {
  canAdminFinalizeRotation,
  canGenerateRotation,
  canManagerDecideRotation,
  scopedSiteId,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

const SHIFT_OPTIONS: ShiftCode[] = ["A", "B", "C", "G", "OFF"];

function weekBuckets(fromDate: string, toDate: string) {
  const start = dayjs(fromDate);
  const end = dayjs(toDate);
  const weeks: { key: string; label: string; from: string; to: string }[] = [];
  let cursor = start.startOf("week"); // Sunday
  let i = 0;
  while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
    const wFrom = cursor.format("YYYY-MM-DD");
    const wTo = cursor.add(6, "day").format("YYYY-MM-DD");
    const clippedFrom = wFrom < fromDate ? fromDate : wFrom;
    const clippedTo = wTo > toDate ? toDate : wTo;
    if (clippedFrom <= toDate && clippedTo >= fromDate) {
      weeks.push({
        key: `w${i}`,
        label: `W${i + 1} · ${dayjs(clippedFrom).format("D MMM")}`,
        from: clippedFrom,
        to: clippedTo,
      });
    }
    cursor = cursor.add(7, "day");
    i += 1;
    if (i > 6) break;
  }
  return weeks;
}

function primaryCodeForWeek(
  assignments: RotationAssignmentCell[],
  employeeId: string,
  from: string,
  to: string,
): ShiftCode {
  const cells = assignments.filter(
    (a) =>
      a.employeeId === employeeId && a.date >= from && a.date <= to && a.code !== "OFF",
  );
  return cells[0]?.code ?? "OFF";
}

export default function ShiftRotationPage() {
  const { message, modal } = App.useApp();
  const session = getSession();
  const locked = scopedSiteId(session);
  const canGenerate = canGenerateRotation(session);
  const canManager = canManagerDecideRotation(session);
  const canAdmin = canAdminFinalizeRotation(session);
  const [siteId, setSiteId] = useState<string | undefined>(locked);
  const [tick, setTick] = useState(0);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [wizSite, setWizSite] = useState<string | undefined>(locked);
  const [wizMonth, setWizMonth] = useState<Dayjs>(dayjs(EFFECTIVE));
  const [patternId, setPatternId] = useState<RotationPatternId>(ACTIVE_PATTERN.id);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<RotationAssignmentCell[]>([]);

  const [reviewPreview, setReviewPreview] = useState<RotationPreview | null>(null);

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

  const groupOptions = useMemo(() => {
    void tick;
    const set = new Set(getRotationRows(wizSite).map((r) => r.groupId));
    return [...set].sort().map((g) => ({ value: g, label: g }));
  }, [wizSite, tick]);

  const monthKey = wizMonth.format("YYYY-MM");
  const bounds = useMemo(() => monthBounds(monthKey), [monthKey]);
  const weeks = useMemo(
    () => weekBuckets(bounds.fromDate, bounds.toDate),
    [bounds],
  );

  const conflicts = useMemo(() => {
    if (!wizSite || !assignments.length) return [];
    return validateScheduleAssignments(wizSite, assignments);
  }, [wizSite, assignments]);

  const attentionConflicts = conflicts.filter((c) => c.severity === "attention");

  const previewRows = useMemo(() => {
    const ids = [...new Set(assignments.map((a) => a.employeeId))];
    return ids.map((employeeId) => {
      const emp = getEmployeeById(employeeId);
      const row = getRotationRows(wizSite).find((r) => r.employeeId === employeeId);
      const weekCodes: Record<string, ShiftCode> = {};
      for (const w of weeks) {
        weekCodes[w.key] = primaryCodeForWeek(
          assignments,
          employeeId,
          w.from,
          w.to,
        );
      }
      return {
        employeeId,
        employeeName: emp?.name ?? employeeId,
        groupId: row?.groupId ?? "—",
        ...weekCodes,
      };
    });
  }, [assignments, weeks, wizSite]);

  const refresh = () => setTick((t) => t + 1);

  const openWizard = () => {
    const site = locked ?? siteId ?? sites[0]?.id;
    setWizSite(site);
    setWizMonth(dayjs(EFFECTIVE));
    setPatternId(ACTIVE_PATTERN.id);
    setGroupIds([]);
    setAssignments([]);
    setStep(0);
    setWizardOpen(true);
  };

  const fillAssignments = () => {
    if (!wizSite) return;
    const next = buildMonthScheduleAssignments({
      siteId: wizSite,
      monthKey,
      patternId,
      groupIds: groupIds.length ? groupIds : undefined,
    });
    setAssignments(next);
  };

  const setWeekCode = (employeeId: string, weekKey: string, code: ShiftCode) => {
    const week = weeks.find((w) => w.key === weekKey);
    if (!week) return;
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.employeeId !== employeeId) return a;
        if (a.date < week.from || a.date > week.to) return a;
        const dow = dayjs(a.date).day();
        const row = getRotationRows(wizSite).find((r) => r.employeeId === employeeId);
        if (row && dow === row.weeklyOffDay) return { ...a, code: "OFF" };
        return { ...a, code };
      }),
    );
  };

  const submitDraft = () => {
    if (!wizSite) return;
    try {
      submitMonthlyScheduleDraft({
        siteId: wizSite,
        monthKey,
        patternId,
        groupIds: groupIds.length ? groupIds : undefined,
        assignments,
      });
      message.success("Monthly draft submitted for Manager review.");
      setWizardOpen(false);
      setSiteId(wizSite);
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not submit draft");
    }
  };

  const monthAlreadyPublished =
    Boolean(wizSite) && hasPublishedMonth(wizSite!, monthKey);

  const reviewWeeks = useMemo(() => {
    if (!reviewPreview) return [];
    return weekBuckets(reviewPreview.fromDate, reviewPreview.toDate);
  }, [reviewPreview]);

  const reviewRows = useMemo(() => {
    if (!reviewPreview?.assignments?.length) return [];
    const ids = [...new Set(reviewPreview.assignments.map((a) => a.employeeId))];
    return ids.map((employeeId) => {
      const emp = getEmployeeById(employeeId);
      const row = getRotationRows(reviewPreview.siteId).find(
        (r) => r.employeeId === employeeId,
      );
      const weekCodes: Record<string, ShiftCode> = {};
      for (const w of reviewWeeks) {
        weekCodes[w.key] = primaryCodeForWeek(
          reviewPreview.assignments!,
          employeeId,
          w.from,
          w.to,
        );
      }
      return {
        employeeId,
        employeeName: emp?.name ?? employeeId,
        groupId: row?.groupId ?? "—",
        ...weekCodes,
      };
    });
  }, [reviewPreview, reviewWeeks]);

  const openReview = (preview: RotationPreview) => {
    const role =
      preview.status === "pending_admin"
        ? ("admin" as const)
        : ("manager" as const);
    if (
      (role === "manager" && canManager) ||
      (role === "admin" && canAdmin)
    ) {
      try {
        markRotationScheduleViewed(preview.id, role);
        refresh();
      } catch {
        /* ignore */
      }
    }
    const latest =
      getRotationPreviews().find((p) => p.id === preview.id) ?? preview;
    setReviewPreview(latest);
  };

  const askDecision = (
    preview: RotationPreview,
    stage: "manager" | "admin",
    outcome: "approved" | "rejected",
  ) => {
    let remark = "";
    modal.confirm({
      title:
        outcome === "approved"
          ? stage === "manager"
            ? "Approve and send to Admin"
            : "Approve and publish live"
          : "Reject draft",
      content: (
        <Input.TextArea
          rows={3}
          placeholder="Remark (required)"
          onChange={(e) => {
            remark = e.target.value;
          }}
        />
      ),
      okText: outcome === "approved" ? "Confirm approve" : "Confirm reject",
      okButtonProps: { danger: outcome === "rejected" },
      onOk: () => {
        try {
          const by = session?.name ?? session?.email ?? "Reviewer";
          if (stage === "manager") {
            managerDecideRotation(preview.id, { by, remark, outcome });
            message.success(
              outcome === "approved"
                ? "Sent to Admin for final approval."
                : "Draft rejected.",
            );
          } else {
            adminDecideRotation(preview.id, { by, remark, outcome });
            message.success(
              outcome === "approved"
                ? "Published to the live roster."
                : "Draft rejected by Admin.",
            );
          }
          setReviewPreview(null);
          refresh();
        } catch (err) {
          message.error(err instanceof Error ? err.message : "Decision failed");
          return Promise.reject(err);
        }
      },
    });
  };

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
          {ACTIVE_PATTERN.description}. Shift In-Charge builds a monthly draft →
          Manager reviews (must view first) → Admin approves with remarks to
          publish to the live roster (Schedule).
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
          disabled={!canGenerate}
          onClick={openWizard}
        >
          Build monthly schedule
        </Button>
        {!canGenerate ? (
          <span style={{ fontSize: 12, color: nectarColors.muted, alignSelf: "center" }}>
            Drafting requires Shift In-Charge or Manager
          </span>
        ) : (
          <span style={{ fontSize: 12, color: nectarColors.muted, alignSelf: "center" }}>
            After submit: Manager → Admin (view required before decide)
          </span>
        )}
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
          { title: "Role", dataIndex: "groupId" },
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
          Drafts pending publish
        </div>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={previews}
          columns={[
            {
              title: "Label",
              key: "label",
              render: (_, r) => r.label ?? `${r.fromDate} → ${r.toDate}`,
            },
            { title: "From", dataIndex: "fromDate" },
            { title: "To", dataIndex: "toDate" },
            {
              title: "Site",
              dataIndex: "siteId",
              render: (id) => getSiteName(id),
            },
            { title: "Employees", dataIndex: "employeesAffected" },
            {
              title: "Pattern",
              key: "pat",
              render: (_, r) => r.patternId ?? "—",
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
                const awaitingManager =
                  r.status === "pending_manager" || r.status === "draft";
                const awaitingAdmin = r.status === "pending_admin";
                if (!awaitingManager && !awaitingAdmin) return "—";

                const canActManager = awaitingManager && canManager;
                const canActAdmin = awaitingAdmin && canAdmin;

                return (
                  <Space size={6} wrap>
                    <Button size="small" onClick={() => openReview(r)}>
                      View schedule
                    </Button>
                    {canActManager ? (
                      <>
                        <Button
                          size="small"
                          type="primary"
                          disabled={!r.managerViewedAt}
                          onClick={() => askDecision(r, "manager", "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          danger
                          disabled={!r.managerViewedAt}
                          onClick={() => askDecision(r, "manager", "rejected")}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {canActAdmin ? (
                      <>
                        <Button
                          size="small"
                          type="primary"
                          disabled={!r.adminViewedAt}
                          onClick={() => askDecision(r, "admin", "approved")}
                        >
                          Publish
                        </Button>
                        <Button
                          size="small"
                          danger
                          disabled={!r.adminViewedAt}
                          onClick={() => askDecision(r, "admin", "rejected")}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {awaitingManager && !canManager ? (
                      <span style={{ color: nectarColors.muted, fontSize: 12 }}>
                        Awaiting Manager
                      </span>
                    ) : null}
                    {awaitingAdmin && !canAdmin ? (
                      <span style={{ color: nectarColors.muted, fontSize: 12 }}>
                        Awaiting Admin
                      </span>
                    ) : null}
                  </Space>
                );
              },
            },
          ]}
        />
      </div>

      <Drawer
        title={
          reviewPreview
            ? `Schedule review · ${reviewPreview.label ?? reviewPreview.fromDate}`
            : "Schedule review"
        }
        open={Boolean(reviewPreview)}
        onClose={() => setReviewPreview(null)}
        size={920}
        destroyOnHidden
      >
        {reviewPreview ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Alert
              type="info"
              showIcon
              title={
                reviewPreview.status === "pending_admin"
                  ? "Admin: review the grid, then Approve (publish) or Reject with a remark."
                  : "Manager: review the grid, then Approve (send to Admin) or Reject with a remark."
              }
            />
            {reviewPreview.managerDecision ? (
              <div style={{ fontSize: 13, color: nectarColors.muted }}>
                Manager {reviewPreview.managerDecision.outcome} by{" "}
                {reviewPreview.managerDecision.by}: “
                {reviewPreview.managerDecision.remark}”
              </div>
            ) : null}
            {reviewPreview.assignments?.length ? (
              <Table
                size="small"
                rowKey="employeeId"
                pagination={false}
                scroll={{ x: true }}
                dataSource={reviewRows}
                columns={[
                  { title: "Employee", dataIndex: "employeeName", fixed: "left", width: 160 },
                  { title: "Role", dataIndex: "groupId", width: 90 },
                  ...reviewWeeks.map((w) => ({
                    title: w.label,
                    dataIndex: w.key,
                    width: 72,
                    render: (c: ShiftCode) => (
                      <Tag color={getShiftByCode(c)?.color}>{c}</Tag>
                    ),
                  })),
                ]}
              />
            ) : (
              <p style={{ color: nectarColors.muted }}>
                Legacy stub ({reviewPreview.fromCode} → {reviewPreview.toCode}). No
                monthly grid on this draft.
              </p>
            )}
            <Space>
              {(reviewPreview.status === "pending_manager" ||
                reviewPreview.status === "draft") &&
              canManager ? (
                <>
                  <Button
                    type="primary"
                    disabled={!reviewPreview.managerViewedAt}
                    onClick={() =>
                      askDecision(reviewPreview, "manager", "approved")
                    }
                  >
                    Approve → Admin
                  </Button>
                  <Button
                    danger
                    disabled={!reviewPreview.managerViewedAt}
                    onClick={() =>
                      askDecision(reviewPreview, "manager", "rejected")
                    }
                  >
                    Reject
                  </Button>
                </>
              ) : null}
              {reviewPreview.status === "pending_admin" && canAdmin ? (
                <>
                  <Button
                    type="primary"
                    disabled={!reviewPreview.adminViewedAt}
                    onClick={() =>
                      askDecision(reviewPreview, "admin", "approved")
                    }
                  >
                    Approve & publish
                  </Button>
                  <Button
                    danger
                    disabled={!reviewPreview.adminViewedAt}
                    onClick={() =>
                      askDecision(reviewPreview, "admin", "rejected")
                    }
                  >
                    Reject
                  </Button>
                </>
              ) : null}
            </Space>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        title="Build monthly schedule"
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        size={920}
        destroyOnHidden
        styles={{ body: { display: "flex", flexDirection: "column", gap: 16 } }}
        footer={
          <Space style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            <Space>
              {step < 4 ? (
                <Button
                  type="primary"
                  onClick={() => {
                    if (step === 0 && !wizSite) {
                      message.error("Pick a site");
                      return;
                    }
                    if (step === 1) {
                      fillAssignments();
                    }
                    if (step === 3 && attentionConflicts.length) {
                      message.error("Fix attention conflicts before continuing");
                      return;
                    }
                    setStep((s) => s + 1);
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="primary"
                  disabled={
                    attentionConflicts.length > 0 ||
                    !assignments.length ||
                    monthAlreadyPublished
                  }
                  onClick={submitDraft}
                >
                  Submit for Manager review
                </Button>
              )}
            </Space>
          </Space>
        }
      >
        <Steps
          size="small"
          current={step}
          items={[
            { title: "Scope" },
            { title: "Pattern" },
            { title: "Preview" },
            { title: "Check" },
            { title: "Submit" },
          ]}
          style={{ marginBottom: 8 }}
        />

        {step === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
            <div>
              <div style={{ marginBottom: 6, fontSize: 13 }}>Site</div>
              <Select
                style={{ width: "100%" }}
                value={wizSite}
                options={sites.map((s) => ({ value: s.id, label: s.name }))}
                onChange={setWizSite}
                disabled={Boolean(locked)}
              />
            </div>
            <div>
              <div style={{ marginBottom: 6, fontSize: 13 }}>Month</div>
              <DatePicker
                picker="month"
                style={{ width: "100%" }}
                value={wizMonth}
                onChange={(d) => d && setWizMonth(d)}
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
            <div>
              <div style={{ marginBottom: 6, fontSize: 13 }}>Rotation pattern</div>
              <Select
                style={{ width: "100%" }}
                value={patternId}
                options={rotationPatterns.map((p) => ({
                  value: p.id,
                  label: `${p.name} — ${p.description}`,
                }))}
                onChange={(v) => setPatternId(v)}
              />
            </div>
            <div>
              <div style={{ marginBottom: 6, fontSize: 13 }}>
                Roles (leave empty for all four)
              </div>
              <Select
                mode="multiple"
                allowClear
                style={{ width: "100%" }}
                placeholder="A, B, C, Reliever"
                value={groupIds}
                options={groupOptions}
                onChange={setGroupIds}
              />
            </div>
            <p style={{ margin: 0, color: nectarColors.muted, fontSize: 13 }}>
              Demo roster is four people per plant: one on <strong>A</strong>{" "}
              (morning), one on <strong>B</strong> (afternoon), one on{" "}
              <strong>C</strong> (night), one <strong>Reliever</strong>{" "}
              (general). Filter here if you only want some of them in this draft.
              Next fills the month from each person&apos;s current shift (rest-safe
              on C→A). You can edit cells on the following step.
            </p>
          </div>
        ) : null}

        {step === 2 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button size="small" onClick={fillAssignments} style={{ alignSelf: "flex-start" }}>
              Re-fill from pattern
            </Button>
            <Table
              size="small"
              rowKey="employeeId"
              pagination={false}
              scroll={{ x: 700, y: 420 }}
              dataSource={previewRows}
              columns={[
                { title: "Employee", dataIndex: "employeeName", fixed: "left", width: 160 },
                { title: "Role", dataIndex: "groupId", width: 90 },
                ...weeks.map((w) => ({
                  title: w.label,
                  dataIndex: w.key,
                  width: 110,
                  render: (code: ShiftCode, row: { employeeId: string }) => (
                    <Select
                      size="small"
                      value={code}
                      style={{ width: 88 }}
                      options={SHIFT_OPTIONS.map((c) => ({ value: c, label: c }))}
                      onChange={(v) => setWeekCode(row.employeeId, w.key, v)}
                    />
                  ),
                })),
              ]}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {attentionConflicts.length ? (
              <Alert
                type="error"
                showIcon
                title={`${attentionConflicts.length} attention conflict(s) — fix before submit`}
              />
            ) : (
              <Alert type="success" showIcon title="No blocking conflicts" />
            )}
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={conflicts}
              locale={{ emptyText: "No conflicts" }}
              columns={[
                { title: "Severity", dataIndex: "severity", width: 100 },
                { title: "Employee", dataIndex: "employeeName" },
                { title: "Date", dataIndex: "date", width: 120 },
                { title: "Type", dataIndex: "type", width: 100 },
                { title: "Message", dataIndex: "message" },
              ]}
            />
          </div>
        ) : null}

        {step === 4 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {monthAlreadyPublished ? (
              <Alert
                type="error"
                showIcon
                title={`A schedule for ${monthKey} is already published for this site. You cannot submit another draft for this month.`}
              />
            ) : null}
            <p style={{ margin: 0, fontSize: 14 }}>
              Site: <strong>{wizSite ? getSiteName(wizSite) : "—"}</strong>
              <br />
              Month: <strong>{monthKey}</strong> ({bounds.fromDate} → {bounds.toDate})
              <br />
              Pattern:{" "}
              <strong>
                {rotationPatterns.find((p) => p.id === patternId)?.name}
              </strong>
              <br />
              Employees: <strong>{previewRows.length}</strong>
              <br />
              Blocking conflicts: <strong>{attentionConflicts.length}</strong>
            </p>
            <p style={{ margin: 0, color: nectarColors.muted, fontSize: 13 }}>
              Submitting creates a draft for Manager review, then Admin final
              approval before it goes live on Schedule.
            </p>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
