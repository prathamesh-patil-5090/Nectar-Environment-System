"use client";

import { Suspense } from "react";
import RelieverCompetitionPage from "./CompetitionClient";

export default function Page() {
  return (
    <Suspense
      fallback={<div style={{ padding: 24 }}>Loading competition…</div>}
    >
      <RelieverCompetitionPage />
    </Suspense>
  );
}
