"use client";

import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import TeamProgressTable from "@/components/training/records/TeamProgressTable";
import styles from "@/components/training/ui/training.module.css";

/** Supervisors / shift in-charges / site in-charges: their team's training (view only; flagging is for managers). */
export default function MyTeamTrainingPage() {
  return (
    <div className={styles.page}>
      <TrainingSubNav />
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0B1A24" }}>My team</h1>
        <p style={{ margin: "4px 0 0", color: "#4A6375" }}>
          Training progress of the people who report to you. Only their manager or the Director can flag or assign training.
        </p>
      </header>
      <TeamProgressTable />
    </div>
  );
}
