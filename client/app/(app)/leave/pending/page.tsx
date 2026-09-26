"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spin } from "antd";

/** Pending justifications live under Leave → Requests (tab). */
export default function LeavePendingRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/leave/requests?view=pending");
  }, [router]);
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
      <Spin tip="Opening requests…" />
    </div>
  );
}
