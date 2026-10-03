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

  const items = [
    { key: "team", label: viewer.role === "manager" ? "My team" : "Team progress", children: <TeamProgressTable /> },
    ...(canFlag ? [{ key: "flags", label: "Assign & flag", children: <MyFlagsTab /> }] : []),
    { key: "evaluations", label: "Evaluations", children: <EvaluationsTab /> },
    { key: "schedule", label: "Assessment schedule", children: <TrainingScheduleView /> },
    { key: "lni", label: "LNI matrix", children: <LniMatrixView siteScope={viewer.session?.siteId} onOpenCourse={(c) => router.push(`/training/course/${c.id}`)} /> },
    { key: "reports", label: "Reports", children: <ReportsTab /> },
    ...(isAdmin ? [{ key: "admin", label: "Mentors & communities", children: <AdminTab /> }] : []),
  ];

  return (
    <div className={styles.page}>
      <TrainingSubNav />
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0B1A24" }}>Academic Records</h1>
        <p style={{ margin: "4px 0 0", color: "#4A6375" }}>
          Team progress, assignments and weak-area flags, on-site evaluations and reports.
        </p>
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
