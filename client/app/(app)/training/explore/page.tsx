"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Checkbox, Drawer, Empty, Input, Select, Skeleton } from "antd";
import { FilterOutlined, SearchOutlined } from "@ant-design/icons";
import { getCatalog } from "@/lib/api/training";
import { useAsync, useViewer } from "@/lib/training/hooks";
import type { CatalogItem } from "@/lib/training/types";
import TrainingSubNav from "@/components/training/ui/TrainingSubNav";
import CourseCard from "@/components/training/ui/CourseCard";
import { CARD_GRID } from "@/components/training/ui/Shelf";
import { tr, trTable, trData } from "@/lib/i18n";

const PLANTS: Record<string, string> = trTable({ ETP: "ETP", RO: "RO / WTP", MEE: "MEE / ZLD" });
const LEVELS = ["Foundation", "Intermediate", "Advanced"];
const SORTS: Record<string, string> = trTable({ relevance: "Relevance", rating: "Highest rated", short: "Shortest", az: "A–Z" });
const PAGE = 12;

function statusBadge(c: CatalogItem) {
  if (c.myStatus === "CERTIFIED") return { text: tr("Certified"), color: "green" };
  if (c.myStatus) return { text: tr("In progress"), color: "blue" };
  return undefined;
}

/** "Effluent Treatment Plants (ETP)" → "ETP"; names without an abbreviation stay as they are. */
const shortDomain = (s: string) => s.match(/\(([^)]+)\)\s*$/)?.[1] ?? s;

const chip = (active: boolean) =>
  `px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors cursor-pointer ${active ? "bg-[#1C4463] border-[#1C4463] text-white" : "bg-white border-slate-200 text-slate-600 hover:border-[#1C4463] hover:text-[#1C4463]"}`;

/** Explore the catalog: search hero, domain chips, filters (kept in the URL) and sort. */
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
  const clearAll = () => router.replace(pathname ?? "/training/explore");

  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    (data ?? []).forEach((c) => c.section && counts.set(c.section, (counts.get(c.section) ?? 0) + 1));
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

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
    <div className="flex flex-col gap-4">
      <label>
        <div className="font-semibold text-slate-900 mb-1">{tr("Plant")}</div>
        <Select allowClear placeholder={tr("Any plant")} value={plant || undefined} onChange={(v) => setParam("plant", v ?? null)} options={Object.entries(PLANTS).map(([value, label]) => ({ value, label }))} style={{ width: "100%" }} />
      </label>
      <label>
        <div className="font-semibold text-slate-900 mb-1">{tr("Level")}</div>
        <Select allowClear placeholder={tr("Any level")} value={level || undefined} onChange={(v) => setParam("level", v ?? null)} options={LEVELS.map((l) => ({ value: l, label: tr(l) }))} style={{ width: "100%" }} />
      </label>
      <label>
        <div className="font-semibold text-slate-900 mb-1">{tr("Sort by")}</div>
        <Select value={sort} onChange={(v) => setParam("sort", v === "relevance" ? null : v)} options={Object.entries(SORTS).map(([value, label]) => ({ value, label }))} style={{ width: "100%" }} />
      </label>
      <Checkbox checked={notStarted} onChange={(e) => setParam("new", e.target.checked ? "1" : null)}>{tr("Only courses I haven't started")}</Checkbox>
      {skill && (
        <Alert type="info" title={tr("Skill: {skill}", { skill: trData(skill) })} action={<Button size="small" type="link" onClick={() => setParam("skill", null)}>{tr("Clear")}</Button>} />
      )}
      {filtersActive && <Button onClick={clearAll}>{tr("Clear all filters")}</Button>}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <TrainingSubNav />

      {/* Search hero */}
      <header className="rounded-3xl bg-gradient-to-br from-[#1C4463] to-[#0B1A24] p-6 sm:p-8 flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{tr("Explore courses")}</h1>
          <p className="m-0 mt-1 text-white/70">
            {data ? tr("{dataCount} courses across {sectionCount} domains, built for our plants.", { dataCount: data.length, sectionCount: sections.length }) : tr("Courses built for our plants.")}
          </p>
        </div>
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder={tr("Search courses, skills or codes")}
          defaultValue={qText}
          onPressEnter={(e) => setParam("q", (e.target as HTMLInputElement).value || null)}
          onChange={(e) => !e.target.value && setParam("q", null)}
          className="max-w-2xl rounded-full!"
          aria-label={tr("Search courses")}
        />
      </header>

      {/* Domain chips */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr("Domains")}>
        <button type="button" role="tab" aria-selected={!section} className={chip(!section)} onClick={() => setParam("section", null)}>
          {tr("All")}
        </button>
        {sections.map(([s, n]) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} title={trData(s)} className={chip(section === s)} onClick={() => setParam("section", section === s ? null : s)}>
            {trData(shortDomain(s))} <span className="opacity-60">{n}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] items-start">
        <aside className="hidden lg:block bg-white border border-slate-200 rounded-3xl p-5 lg:sticky lg:top-4" aria-label={tr("Filters")}>
          {filters}
        </aside>

        <div className="flex flex-col gap-5 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-slate-500">
              {loading ? tr("Loading courses…") : (results.length === 1 ? tr("1 course") : tr("{resultCount} courses", { resultCount: results.length }))}
              {qText && <span> {tr("for “{qText}”", { qText: trData(qText) })}</span>}
            </div>
            <Button icon={<FilterOutlined />} onClick={() => setDrawer(true)} className="lg:hidden!">{tr("Filters")}</Button>
          </div>
          {error ? (
            <Alert type="error" showIcon title={tr("Couldn't load the catalog")} description={trData(error)} action={<Button onClick={reload}>{tr("Try again")}</Button>} />
          ) : loading ? (
            <Skeleton active />
          ) : results.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-8">
              <Empty description={tr("No courses match these filters")}>
                <Button onClick={clearAll}>{tr("Clear filters")}</Button>
              </Empty>
            </div>
          ) : (
            <>
              <div className={CARD_GRID}>
                {results.slice(0, shown).map((c) => (
                  <CourseCard key={c.id} course={c} badge={statusBadge(c)} progressPct={c.myStatus && c.myStatus !== "CERTIFIED" ? c.myProgressPct : undefined} />
                ))}
              </div>
              {shown < results.length && (
                <div className="text-center">
                  <Button shape="round" onClick={() => setShown((n) => n + PAGE)}>{tr("Load more ({count})", { count: results.length - shown })}</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Drawer title={tr("Filters")} open={drawer} onClose={() => setDrawer(false)} placement="left" size={300}>
        {filters}
      </Drawer>
    </div>
  );
}
