"use client";

import { Suspense } from "react";
import LeaveLifecycleClient from "./LifecycleClient";

export default function LeaveLifecyclePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading lifecycle…</div>}>
      <LeaveLifecycleClient />
    </Suspense>
  );
}
