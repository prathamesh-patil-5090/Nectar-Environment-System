"use client";

import { useMemo, useState } from "react";
import { Button, Card, Col, Row, Segmented, Statistic, Table, Tag } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { getEventsReport, type EventAttendanceRow } from "@/lib/api/training";
import {
  getAllCourses,
  getAllEnrollments,
  getAllCertificates,
  getPeople,
  getSiteName,
  getTrainingAssignments,
  useTrainingData,
} from "@/lib/training/store";
import { useAsync } from "@/lib/training/hooks";
import { tr, trCell, trData } from "@/lib/i18n";

function downloadCsv(name: string, header: string[], rows: (string | number | undefined)[][]) {
  const esc = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

/** Completion by site and course, certificates expiring soon, event attendance. All from the database. */
export default function ReportsTab() {
  const { version, ready } = useTrainingData();
  const [days, setDays] = useState<30 | 60 | 90>(60);
  const [now] = useState(() => Date.now());
  const events = useAsync(() => getEventsReport(), []);

  const { bySite, byCourse, totals } = useMemo(() => {
    void version;
    const people = getPeople();
    const enrollments = getAllEnrollments();
    const today = new Date().toISOString().slice(0, 10);
    const overdueIds = new Set(
      getTrainingAssignments()
        .filter((a) => a.kind !== "suggested" && ["open", "in_progress", "assigned"].includes(a.status) && a.dueDate && a.dueDate.slice(0, 10) < today)
        .map((a) => a.employeeId),
    );
    const siteIds = [...new Set(people.map((p) => p.siteId ?? ""))];
    const bySite = siteIds.map((sid) => {
      const ids = new Set(people.filter((p) => (p.siteId ?? "") === sid).map((p) => p.id));
      const e = enrollments.filter((x) => ids.has(x.employeeId));
      const certified = e.filter((x) => x.status === "CERTIFIED").length;
      return {
        key: sid || "none",
        site: getSiteName(sid) ?? tr("No site"),
        people: ids.size,
        enrolled: e.length,
        certified,
        completion: e.length ? Math.round((certified / e.length) * 100) : 0,
        overduePeople: [...ids].filter((id) => overdueIds.has(id)).length,
      };
    });
    const byCourse = getAllCourses()
      .map((c) => {
        const e = enrollments.filter((x) => x.courseId === c.id);
        return {
          key: c.id,
          course: `${c.code} · ${c.title}`,
          enrolled: e.length,
          inProgress: e.filter((x) => x.status !== "CERTIFIED").length,
          certified: e.filter((x) => x.status === "CERTIFIED").length,
        };
      })
      .filter((r) => r.enrolled > 0)
      .sort((a, b) => b.enrolled - a.enrolled);
    return {
      bySite,
      byCourse,
      totals: {
        enrolled: enrollments.length,
        certified: enrollments.filter((x) => x.status === "CERTIFIED").length,
        overdue: overdueIds.size,
      },
    };
  }, [version]);

  const expiring = useMemo(() => {
    void version;
    const limit = now + days * 86400000;
    return getAllCertificates()
      .filter((c) => c.expiresOn && Date.parse(c.expiresOn) <= limit)
      .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
  }, [version, days, now]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Card loading={!ready}><Statistic title={tr("Enrollments")} value={totals.enrolled} /></Card></Col>
        <Col xs={12} md={6}><Card loading={!ready}><Statistic title={tr("Certified")} value={totals.certified} /></Card></Col>
        <Col xs={12} md={6}><Card loading={!ready}><Statistic title={tr("People with overdue training")} value={totals.overdue} /></Card></Col>
        <Col xs={12} md={6}><Card loading={events.loading}><Statistic title={tr("Events held")} value={(events.data ?? []).filter((e) => e.status === "completed").length} /></Card></Col>
      </Row>

      <Card
        title={tr("Completion by site")}
        extra={<Button icon={<DownloadOutlined />} onClick={() => downloadCsv("completion-by-site.csv", ["Site", "People", "Enrollments", "Certified", "Completion %", "People overdue"], bySite.map((r) => [r.site, r.people, r.enrolled, r.certified, r.completion, r.overduePeople]))}>CSV</Button>}
      >
        <Table
          size="small"
          pagination={false}
          loading={!ready}
          dataSource={bySite}
          scroll={{ x: 600 }}
          columns={[
            { title: tr("Site"), dataIndex: "site", render: trCell },
            { title: tr("People"), dataIndex: "people", render: trCell, align: "center" },
            { title: tr("Enrollments"), dataIndex: "enrolled", render: trCell, align: "center" },
            { title: tr("Certified"), dataIndex: "certified", render: trCell, align: "center" },
            { title: tr("Completion"), dataIndex: "completion", align: "center", render: (n: number) => `${n}%` },
            { title: tr("People overdue"), dataIndex: "overduePeople", align: "center", render: (n: number) => (n ? <Tag color="red">{n}</Tag> : 0) },
          ]}
        />
      </Card>

      <Card
        title={tr("By course")}
        extra={<Button icon={<DownloadOutlined />} onClick={() => downloadCsv("by-course.csv", ["Course", "Enrolled", "In progress", "Certified"], byCourse.map((r) => [r.course, r.enrolled, r.inProgress, r.certified]))}>CSV</Button>}
      >
        <Table
          size="small"
          loading={!ready}
          dataSource={byCourse}
          scroll={{ x: 600 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          columns={[
            { title: tr("Course"), dataIndex: "course", render: trCell },
            { title: tr("Enrolled"), dataIndex: "enrolled", render: trCell, align: "center" },
            { title: tr("In progress"), dataIndex: "inProgress", render: trCell, align: "center" },
            { title: tr("Certified"), dataIndex: "certified", render: trCell, align: "center" },
          ]}
        />
      </Card>

      <Card
        title={tr("Certificates expiring")}
        extra={
          <Segmented
            value={days}
            onChange={(v) => setDays(v as 30 | 60 | 90)}
            options={[{ value: 30, label: tr("30 days") }, { value: 60, label: tr("60 days") }, { value: 90, label: tr("90 days") }]}
          />
        }
      >
        <Table
          size="small"
          loading={!ready}
          dataSource={expiring}
          rowKey="id"
          scroll={{ x: 600 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: tr("No certificates expire within {days} days", { days }) }}
          columns={[
            { title: tr("Employee"), dataIndex: "employeeName", render: trCell },
            { title: tr("Site"), dataIndex: "siteName", render: trCell },
            { title: tr("Certificate"), dataIndex: "courseTitle", render: trCell },
            {
              title: tr("Expires"),
              dataIndex: "expiresOn",
              render: (d: string, r) => <Tag color={r.status === "expired" ? "red" : "gold"}>{trData(d)}</Tag>,
            },
          ]}
        />
      </Card>

      <Card
        title={tr("Event attendance")}
        extra={
          <Button
            icon={<DownloadOutlined />}
            onClick={() =>
              downloadCsv(
                "event-attendance.csv",
                ["Event", "Date", "Host", "Community", "Capacity", "Going", "Attended", "No-show", "Cancelled", "Status"],
                (events.data ?? []).map((e) => [e.title, e.startsAt.slice(0, 10), e.host, e.community, e.capacity, e.going, e.attended, e.noShow, e.cancelled, e.status]),
              )
            }
          >
            CSV
          </Button>
        }
      >
        <Table<EventAttendanceRow>
          size="small"
          rowKey="id"
          loading={events.loading}
          dataSource={events.data ?? []}
          scroll={{ x: 800 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          columns={[
            { title: tr("Event"), dataIndex: "title", render: trCell, ellipsis: true },
            { title: tr("Date"), dataIndex: "startsAt", render: (d: string) => d.slice(0, 10) },
            { title: tr("Host"), dataIndex: "host", render: trCell },
            { title: tr("Going"), dataIndex: "going", render: trCell, align: "center" },
            { title: tr("Attended"), dataIndex: "attended", render: trCell, align: "center" },
            { title: tr("No-show"), dataIndex: "noShow", render: trCell, align: "center" },
            { title: tr("Status"), dataIndex: "status", render: (s: string) => <Tag>{trData(s)}</Tag> },
          ]}
        />
      </Card>
    </div>
  );
}
