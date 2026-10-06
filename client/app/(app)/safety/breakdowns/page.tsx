"use client";

import EventsTable from "@/components/safety/EventsTable";
import { tr } from "@/lib/i18n";

export default function SafetyBreakdownsPage() {
  return <EventsTable types={["breakdown"]} title={tr("Plant breakdowns")} />;
}
