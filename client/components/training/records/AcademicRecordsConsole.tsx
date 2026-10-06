"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "antd";
import TrainingSubNav from "../ui/TrainingSubNav";
import LniMatrixView from "../LniMatrixView";
import TrainingScheduleView from "../TrainingScheduleView";
import TeamProgressTable from "./TeamProgressTable";
import MyFlagsTab from "./MyFlagsTab";
import EvaluationsTab from "./EvaluationsTab";
import ReportsTab from "./ReportsTab";
import AdminTab from "./AdminTab";
import { useViewer } from "@/lib/training/hooks";
import { useT } from "@/lib/i18n";
import styles from "../ui/training.module.css";

/** Training for HR / Manager / Director ("Academic Records"). The active tab is kept in the URL. */
export default function AcademicRecordsConsole() {
  const viewer = useViewer();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params?.get("tab") ?? "team";
  const canFlag = viewer.role === "director" || viewer.role === "manager";
  const isAdmin = viewer.role === "director" || viewer.role === "hr";
  const t = useT();

  const items = [
    {
      key: "team",
      label: viewer.role === "manager" ? t("training.myTeam") : t("training.teamProgress"),
      children: <TeamProgressTable />,
    },
    ...(canFlag ? [{ key: "flags", label: t("training.assignFlag"), children: <MyFlagsTab /> }] : []),
    { key: "evaluations", label: t("training.evaluations"), children: <EvaluationsTab /> },
    { key: "schedule", label: t("training.assessmentSchedule"), children: <TrainingScheduleView /> },
    {
      key: "lni",
      label: t("training.lniMatrix"),
      children: (
        <LniMatrixView
          siteScope={viewer.session?.siteId}
          onOpenCourse={(c) => router.push(`/training/course/${c.id}`)}
        />
      ),
    },
    { key: "reports", label: t("training.reports"), children: <ReportsTab /> },
    ...(isAdmin
      ? [{ key: "admin", label: t("training.mentorsCommunities"), children: <AdminTab /> }]
      : []),
  ];

  return (
    <div className={styles.page}>
      <TrainingSubNav />
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0B1A24" }}>
          {t("training.academicRecords")}
        </h1>
        <p style={{ margin: "4px 0 0", color: "#4A6375" }}>{t("training.academicSubtitle")}</p>
      </header>
      <Tabs
        activeKey={items.some((i) => i.key === tab) ? tab : "team"}
        onChange={(k) => router.replace(`${pathname}?tab=${k}`, { scroll: false })}
        items={items}
        destroyOnHidden
      />
    </div>
  );
}
