"use client";

import { Suspense } from "react";
import OtDecisionsClient from "./OtDecisionsClient";

export default function OtDecisionsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading OT decisions…</div>}>
      <OtDecisionsClient />
    </Suspense>
  );
}
