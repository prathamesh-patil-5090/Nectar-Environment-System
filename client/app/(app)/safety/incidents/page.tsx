"use client";

import EventsTable from "@/components/safety/EventsTable";
import { tr } from "@/lib/i18n";

export default function SafetyIncidentsPage() {
  return <EventsTable types={["incident", "near_miss"]} title={tr("Incident & near-miss history")} />;
}
