"use client";

import TrainingHome from "@/components/training/TrainingHome";
import AcademicRecordsConsole from "@/components/training/records/AcademicRecordsConsole";
import { useViewer } from "@/lib/training/hooks";

/**
 * Academy roles (employee, supervisor, shift / safety / site in-charge) get their personal Home.
 * Academic Records roles (HR, Manager, Director) get the management console; their own
 * learning Home is at /training/home.
 */
export default function TrainingPage() {
  const viewer = useViewer();
  return viewer.isRecords ? <AcademicRecordsConsole /> : <TrainingHome />;
}
