"use client";

import EventsTable from "@/components/safety/EventsTable";

export default function SafetyBreakdownsPage() {
  return <EventsTable types={["breakdown"]} title="Plant breakdowns" />;
}
