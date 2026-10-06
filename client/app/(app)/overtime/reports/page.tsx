"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spin } from "antd";

import { tr } from "@/lib/i18n";
/** Reports live under OverTime → Analysis (Reports tab). */
export default function OtReportsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/overtime/analysis?tab=reports");
  }, [router]);
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}><Spin tip={tr("Opening analysis & reports…")} /></div>
  );
}
