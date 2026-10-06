"use client";

import { Suspense } from "react";
import LeaveLifecycleClient from "./LifecycleClient";
import { tr } from "@/lib/i18n";

export default function LeaveLifecyclePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>{tr("Loading lifecycle…")}</div>}>
      <LeaveLifecycleClient />
    </Suspense>
  );
}
