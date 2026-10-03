"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spin } from "antd";
import { useViewer } from "@/lib/training/hooks";

/** Safety training moved into Training Home (a compulsory section); old links land there. */
export default function SafetyTrainingRedirect() {
  const router = useRouter();
  const viewer = useViewer();
  useEffect(() => {
    router.replace(viewer.isRecords ? "/training/home#safety-training" : "/training#safety-training");
  }, [router, viewer.isRecords]);
  return <div style={{ textAlign: "center", padding: 48 }}><Spin /></div>;
}
