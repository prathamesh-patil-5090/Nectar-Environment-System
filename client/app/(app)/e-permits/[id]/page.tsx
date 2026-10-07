"use client";

import { useParams } from "next/navigation";
import PermitDetail from "@/components/e-permit/PermitDetail";

export default function EPermitPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  return <PermitDetail key={id} id={id} />;
}
