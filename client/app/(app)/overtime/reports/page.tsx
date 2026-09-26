"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spin } from "antd";

/** Reports live under OverTime → Analysis (Reports tab). */
export default function OtReportsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/overtime/analysis?tab=reports");
  }, [router]);
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
      <Spin tip="Opening analysis & reports…" />
    </div>
  );
}
