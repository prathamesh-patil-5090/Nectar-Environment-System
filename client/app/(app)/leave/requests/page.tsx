"use client";

import { Suspense } from "react";
import LeaveRequestsContent from "./LeaveRequestsContent";
import { tr } from "@/lib/i18n";

export default function LeaveRequestsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>{tr("Loading leave requests…")}</div>}><LeaveRequestsContent /></Suspense>
  );
}
