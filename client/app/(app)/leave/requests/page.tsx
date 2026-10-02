"use client";

import { Suspense } from "react";
import LeaveRequestsContent from "./LeaveRequestsContent";

export default function LeaveRequestsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading leave requests…</div>}><LeaveRequestsContent /></Suspense>
  );
}
