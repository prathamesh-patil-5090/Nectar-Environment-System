"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Checkbox, Drawer, Empty, Input, Select, Skeleton } from "antd";
import { FilterOutlined } from "@ant-design/icons";
import { useState } from "react";
import { getCatalog } from "@/lib/api/training";
import { useAsync, useViewer } from "@/lib/training/hooks";
import type { CatalogItem } from "@/lib/training/types";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import CourseCard from "@/components/training/ui/CourseCard";
import styles from "@/components/training/ui/training.module.css";

const PLANTS: Record<string, string> = { ETP: "ETP", RO: "RO / WTP", MEE: "MEE / ZLD" };
const LEVELS = ["Foundation", "Intermediate", "Advanced"];
const SORTS: Record<string, string> = { relevance: "Relevance", rating: "Highest rated", short: "Shortest", az: "A–Z" };
const PAGE = 12;

function statusBadge(c: CatalogItem) {
  if (c.myStatus === "CERTIFIED") return { text: "Certified", color: "green" };
  if (c.myStatus) return { text: "In progress", color: "blue" };
  return undefined;
}

/** Explore the catalog: one search box, filters (kept in the URL) and sort. */
export default function ExplorePage() {
  const viewer = useViewer();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const { data, error, loading, reload } = useAsync(() => getCatalog(viewer.personId), [viewer.personId]);

  const qText = params?.get("q") ?? "";
  const section = params?.get("section") ?? "";
  const plant = params?.get("plant") ?? "";
  const level = params?.get("level") ?? "";
  const skill = params?.get("skill") ?? "";
  const notStarted = params?.get("new") === "1";
  const sort = params?.get("sort") ?? "relevance";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params?.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setShown(PAGE);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const sections = useMemo(() => [...new Set((data ?? []).map((c) => c.section).filter(Boolean))].sort(), [data]);

  const results = useMemo(() => {
    const q = qText.trim().toLowerCase();
    let list = (data ?? []).filter((c) => {
      if (section && c.section !== section) return false;
      if (plant && c.plantType !== plant) return false;
      if (level && c.level !== level) return false;
      if (skill && !c.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) return false;
      if (notStarted && c.myStatus) return false;
      if (!q) return true;
      return [c.title, c.code, c.description, c.section, ...c.skills, ...c.abilityTitles].some((t) => t?.toLowerCase().includes(q));
    });
    if (sort === "rating") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sort === "short") list = [...list].sort((a, b) => (a.estimatedHours ?? 999) - (b.estimatedHours ?? 999));
    if (sort === "az") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [data, qText, section, plant, level, skill, notStarted, sort]);

  const filtersActive = Boolean(section || plant || level || skill || notStarted || qText);

  const filters = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Domain</div>
        <Select allowClear placeholder="All domains" value={section || undefined} onChange={(v) => setParam("section", v ?? null)} options={sections.map((s) => ({ value: s, label: s }))} style={{ width: "100%" }} />
      </label>
      <label>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Plant</div>
        <Select allowClear placeholder="Any plant" value={plant || undefined} onChange={(v) => setParam("plant", v ?? null)} options={Object.entries(PLANTS).map(([value, label]) => ({ value, label }))} style={{ width: "100%" }} />
      </label>
      <label>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Level</div>
        <Select allowClear placeholder="Any level" value={level || undefined} onChange={(v) => setParam("level", v ?? null)} options={LEVELS.map((l) => ({ value: l, label: l }))} style={{ width: "100%" }} />
      </label>
      <Checkbox checked={notStarted} onChange={(e) => setParam("new", e.target.checked ? "1" : null)}>Only courses I haven&apos;t started</Checkbox>
      {skill && (
        <Alert type="info" title={`Skill: ${skill}`} action={<Button size="small" type="link" onClick={() => setParam("skill", null)}>Clear</Button>} />
      )}
      {filtersActive && <Button onClick={() => router.replace(pathname ?? "/training/explore")}>Clear all filters</Button>}
    </div>
  );

  return (
    <div className={styles.page}>
      <TrainingSubNav />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Input.Search
          allowClear
          size="large"
          placeholder="Search courses, skills or codes"
          defaultValue={qText}
          onSearch={(v) => setParam("q", v || null)}
          onChange={(e) => !e.target.value && setParam("q", null)}
          style={{ flex: "1 1 320px", maxWidth: 640 }}
          aria-label="Search courses"
        />
        <Select value={sort} onChange={(v) => setParam("sort", v === "relevance" ? null : v)} options={Object.entries(SORTS).map(([value, label]) => ({ value, label }))} style={{ width: 170 }} aria-label="Sort" />
        <Button icon={<FilterOutlined />} onClick={() => setDrawer(true)} className="explore-filter-btn">Filters</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 240px) minmax(0, 1fr)", gap: 24 }} className="explore-layout">
        <aside className={styles.panel} style={{ alignSelf: "start" }} aria-label="Filters">{filters}</aside>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={{ color: "#4A6375" }}>{loading ? "Loading courses…" : `${results.length} course${results.length === 1 ? "" : "s"}`}</div>
          {error ? (
            <Alert type="error" showIcon title="Couldn't load the catalog" description={error} action={<Button onClick={reload}>Try again</Button>} />
          ) : loading ? (
            <Skeleton active />
          ) : results.length === 0 ? (
            <div className={styles.panel}>
              <Empty description="No courses match these filters">
                <Button onClick={() => router.replace(pathname ?? "/training/explore")}>Clear filters</Button>
              </Empty>
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                {results.slice(0, shown).map((c) => (
                  <CourseCard key={c.id} course={c} badge={statusBadge(c)} progressPct={c.myStatus && c.myStatus !== "CERTIFIED" ? c.myProgressPct : undefined} />
                ))}
              </div>
              {shown < results.length && (
                <div style={{ textAlign: "center" }}>
                  <Button onClick={() => setShown((n) => n + PAGE)}>Load more ({results.length - shown} more)</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Drawer title="Filters" open={drawer} onClose={() => setDrawer(false)} placement="left" size={300}>
        {filters}
      </Drawer>
      <style>{`
        .explore-filter-btn { display: none; }
        @media (max-width: 900px) {
          .explore-layout { grid-template-columns: minmax(0, 1fr) !important; }
          .explore-layout > aside { display: none; }
          .explore-filter-btn { display: inline-flex; }
        }
      `}</style>
    </div>
  );
}
