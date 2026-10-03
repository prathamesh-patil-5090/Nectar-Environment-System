"use client";

import EventsTable from "@/components/safety/EventsTable";

export default function SafetyIncidentsPage() {
  return <EventsTable types={["incident", "near_miss"]} title="Incident & near-miss history" />;
}
