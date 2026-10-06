"use client";

import { Suspense } from "react";
import OtDecisionsClient from "./OtDecisionsClient";
import { tr } from "@/lib/i18n";

export default function OtDecisionsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>{tr("Loading OT decisions…")}</div>}>
      <OtDecisionsClient />
    </Suspense>
  );
}
