"use client";

import Link from "next/link";
import { theme } from "antd";
import Panel from "@/components/Panel";
import { E_PERMITS_ENABLED } from "@/lib/e-permit/feature";
import { useEPermits, useNow } from "@/lib/e-permit/hooks";
import { livePermitsAt } from "@/lib/e-permit/views";
import { CategoryText, ValidityClock } from "./PermitBits";
import { tr, trData } from "@/lib/i18n";

/** Shift hub: permitted work running at the plant now — useful at shift change (renew or return). */
export default function ActivePermitsPanel({ siteId }: { siteId?: string }) {
  const { token } = theme.useToken();
  const { permits, loading } = useEPermits();
  const now = useNow();
  if (!E_PERMITS_ENABLED) return null;
  const live = livePermitsAt(permits, siteId);
  return (
    <Panel title={tr("Active E-Permits")}>
      {live.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {live.slice(0, 8).map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, flexWrap: "wrap" }}>
              <span>
                <Link href={`/e-permits/${p.id}`} style={{ fontWeight: 600 }}>{p.permitNo}</Link> · {trData(p.locationName)} · <CategoryText permit={p} />
              </span>
              <ValidityClock permit={p} now={now} />
            </div>
          ))}
          {live.length > 8 ? <Link href="/e-permits">{tr("All {n} active permits", { n: live.length })}</Link> : null}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: token.colorTextTertiary }}>{loading ? tr("Loading…") : tr("No permitted work running right now.")}</div>
      )}
    </Panel>
  );
}
