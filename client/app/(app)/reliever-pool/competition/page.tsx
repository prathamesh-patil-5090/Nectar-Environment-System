"use client";

import { Suspense } from "react";
import RelieverCompetitionPage from "./CompetitionClient";
import { tr } from "@/lib/i18n";

export default function Page() {
  return (
    <Suspense
      fallback={<div style={{ padding: 24 }}>{tr("Loading competition…")}</div>}
    >
      <RelieverCompetitionPage />
    </Suspense>
  );
}
