"use client";

import { useParams } from "next/navigation";
import EventDetail from "@/components/safety/EventDetail";

export default function SafetyBreakdownPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  return <EventDetail key={id} id={id} />;
}
