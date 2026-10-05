"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, App, Button, Input, Select, Skeleton } from "antd";
import {
  AlertOutlined,
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  PhoneFilled,
  PlusOutlined,
  PrinterOutlined,
  RightOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { createSafetyProtocol, deleteSafetyProtocol, listSafetyProtocols, updateSafetyProtocol } from "@/lib/api/safety";
import type { SafetyProtocol } from "@/lib/safety/types";
import { useDirectory, useSessionUser } from "@/lib/safety/hooks";
import { canEditSafetyProtocols, canViewAllSites, safetyActorOf } from "@/lib/rbac";
import ProtocolEditor from "@/components/safety/protocols/ProtocolEditor";
import { categoryMeta } from "@/components/safety/protocols/protocol-meta";
import styles from "@/components/safety/protocols/protocols.module.css";
import { nectarColors } from "@/lib/theme";
import { useTableMotion } from "@/lib/motion/use-table-motion";

type Contact = { label: string; phone: string };
type ProtocolInput = Omit<SafetyProtocol, "id" | "version" | "updatedBy" | "updatedAtIso">;

/** National numbers first, then site numbers — in the order people should try them. */
const PRIORITY = ["112", "108", "101"];

const norm = (s: string) => s.toLowerCase();

function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const i = norm(text).indexOf(norm(q));
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className={styles.mark}>{text.slice(i, i + q.length)}</mark>
      {highlight(text.slice(i + q.length), q)}
    </>
  );
}

function matches(p: SafetyProtocol, q: string) {
  if (!q) return true;
  const n = norm(q);
  return (
    norm(p.title).includes(n) ||
    norm(p.summary ?? "").includes(n) ||
    norm(categoryMeta(p.category).label).includes(n) ||
    p.steps.some((s) => norm(s).includes(n))
  );
}

function ProtocolsView() {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const user = useSessionUser();
  const dir = useDirectory();

  const [rows, setRows] = useState<SafetyProtocol[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [site, setSite] = useState<string>();
  const [view, setView] = useState<"list" | "reader">(params.get("p") ? "reader" : "list");
  const [editing, setEditing] = useState<SafetyProtocol | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Call strip, search and the protocol panes settle in once the list has loaded.
  const { pageRef } = useTableMotion("", rows !== null || error !== null);

  const orgWide = canViewAllSites(user ?? null);
  const canEdit = canEditSafetyProtocols(user ?? null);
  const scopeSite = orgWide ? undefined : user?.siteId;

  useEffect(() => {
    if (user === undefined) return;
    let alive = true;
    listSafetyProtocols(scopeSite)
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load protocols"));
    return () => {
      alive = false;
    };
  }, [scopeSite, user, reloadKey]);

  const bySite = useMemo(
    () => (rows ?? []).filter((p) => !site || !p.siteIds.length || p.siteIds.includes(site)),
    [rows, site],
  );
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of bySite) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => categoryMeta(a[0]).label.localeCompare(categoryMeta(b[0]).label));
  }, [bySite]);
  const filtered = useMemo(
    () =>
      bySite
        .filter((p) => cat === "all" || p.category === cat)
        .filter((p) => matches(p, q.trim()))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [bySite, cat, q],
  );

  const selectedId = params.get("p");
  const selected = filtered.find((p) => p.id === selectedId) ?? filtered[0];

  const callNumbers = useMemo(() => {
    const seen = new Map<string, Contact>();
    for (const p of bySite) for (const c of p.emergencyContacts) if (!seen.has(c.phone)) seen.set(c.phone, c);
    const rank = (phone: string) => {
      const i = PRIORITY.indexOf(phone);
      return i === -1 ? PRIORITY.length : i;
    };
    return [...seen.values()].sort((a, b) => rank(a.phone) - rank(b.phone)).slice(0, 6);
  }, [bySite]);

  const open = (id: string) => {
    router.replace(`/safety/protocols?p=${encodeURIComponent(id)}`, { scroll: false });
    setView("reader");
  };

  const save = async (values: ProtocolInput) => {
    const actor = safetyActorOf(user ?? null);
    if (!actor) return false;
    setSaving(true);
    try {
      const saved =
        editing && editing !== "new"
          ? await updateSafetyProtocol(editing.id, actor, values)
          : await createSafetyProtocol(actor, values);
      message.success(editing === "new" ? "Protocol published" : `Saved — version ${saved.version}`);
      setReloadKey((k) => k + 1);
      setQ("");
      setCat("all");
      open(saved.id);
      return true;
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const remove = (p: SafetyProtocol) => {
    const actor = safetyActorOf(user ?? null);
    if (!actor) return;
    modal.confirm({
      title: `Delete protocol “${p.title}”?`,
      content: "Sites will no longer see these steps. The record is kept for history.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteSafetyProtocol(p.id, actor);
          // Open the neighbour in the list, or fall back to the empty state
          const i = filtered.findIndex((x) => x.id === p.id);
          const next = filtered[i + 1] ?? filtered[i - 1];
          setRows((cur) => (cur ?? []).filter((x) => x.id !== p.id));
          if (next) router.replace(`/safety/protocols?p=${encodeURIComponent(next.id)}`, { scroll: false });
          else {
            router.replace("/safety/protocols", { scroll: false });
            setView("list");
          }
          setReloadKey((k) => k + 1);
          message.success("Protocol deleted");
        } catch (err) {
          message.error(err instanceof Error ? err.message : "Delete failed");
          throw err;
        }
      },
    });
  };

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/safety/protocols?p=${encodeURIComponent(id)}`);
      message.success("Link copied");
    } catch {
      message.error("Could not copy the link");
    }
  };

  const siteLabel = (p: SafetyProtocol) => (p.siteIds.length ? p.siteIds.map(dir.siteName).join(", ") : "All sites");
  const clearFilters = () => {
    setQ("");
    setCat("all");
    setSite(undefined);
  };

  return (
    <div ref={pageRef} className={styles.page}>
      {/* Call first */}
      <section className={styles.callStrip} aria-label="Emergency numbers" data-anim="intro">
        <div className={styles.callIntro}>
          <h2 className={styles.callTitle}>In an emergency, call first.</h2>
          <p className={styles.callHint}>Then follow the protocol and report it so everyone at the site is alerted.</p>
        </div>
        {callNumbers.length ? (
          <div className={styles.callButtons}>
            {callNumbers.map((c) => (
              <a key={c.phone} href={`tel:${c.phone.replace(/\s+/g, "")}`} className={styles.callBtn}>
                <span className={styles.callIcon} aria-hidden><PhoneFilled /></span>
                <span>
                  <span className={styles.callNumber}>{c.phone}</span>
                  <span className={styles.callLabel}>{c.label}</span>
                </span>
              </a>
            ))}
          </div>
        ) : null}
        <Link href="/safety/report?type=incident" className={styles.reportBtn}>
          <Button danger icon={<AlertOutlined />}>Report emergency</Button>
        </Link>
      </section>

      {/* Find */}
      <div className={styles.toolbar} data-anim="intro">
        <Input
          className={styles.search}
          allowClear
          prefix={<SearchOutlined style={{ color: nectarColors.muted }} />}
          placeholder="Search protocols and steps — e.g. chlorine, shock, burn"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search protocols"
        />
        {orgWide ? (
          <Select
            allowClear
            placeholder="All sites"
            style={{ minWidth: 170 }}
            value={site}
            onChange={setSite}
            options={dir.sites.map((s) => ({ value: s.id, label: s.name }))}
            aria-label="Filter by site"
          />
        ) : null}
        {canEdit ? (
          <div className={styles.toolbarEnd}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>New protocol</Button>
          </div>
        ) : null}
      </div>

      {categories.length > 1 ? (
        <div className={styles.chips} role="toolbar" aria-label="Filter by category">
          <button type="button" className={`${styles.chip} ${cat === "all" ? styles.chipActive : ""}`} aria-pressed={cat === "all"} onClick={() => setCat("all")}>
            All <span className={styles.chipCount}>{bySite.length}</span>
          </button>
          {categories.map(([key, count]) => {
            const m = categoryMeta(key);
            return (
              <button key={key} type="button" className={`${styles.chip} ${cat === key ? styles.chipActive : ""}`} aria-pressed={cat === key} onClick={() => setCat(key)}>
                {m.icon} {m.label} <span className={styles.chipCount}>{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? <Alert type="error" showIcon title="Could not load protocols" description={error} /> : null}

      {rows === null && !error ? (
        <div className={styles.layout} data-view="list">
          <div className={styles.index}><Skeleton active /><Skeleton active /></div>
          <div className={styles.reader} style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 8 }} /></div>
        </div>
      ) : null}

      {rows && !rows.length ? (
        <div className={styles.empty}>
          <h3 style={{ margin: 0 }}>No protocols yet</h3>
          <p style={{ color: nectarColors.muted }}>{canEdit ? "Publish the first one so every site knows what to do." : "Your Safety In-charge will publish them here."}</p>
          {canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>New protocol</Button> : null}
        </div>
      ) : null}

      {rows && rows.length > 0 && !filtered.length ? (
        <div className={styles.empty}>
          <h3 style={{ margin: 0 }}>Nothing matches {q.trim() ? `“${q.trim()}”` : "these filters"}</h3>
          <p style={{ color: nectarColors.muted }}>Try another word, or clear the filters.</p>
          <Button onClick={clearFilters}>Clear filters</Button>
        </div>
      ) : null}

      {selected ? (
        <div className={styles.layout} data-view={view} data-anim="intro">
          <nav className={styles.index} aria-label="Protocols">
            {filtered.map((p) => {
              const m = categoryMeta(p.category);
              const term = q.trim();
              const stepHits = term ? p.steps.filter((s) => norm(s).includes(norm(term))).length : 0;
              const active = p.id === selected.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.item} ${active ? styles.itemActive : ""}`}
                  style={{ ["--accent" as string]: m.color }}
                  aria-current={active ? "true" : undefined}
                  onClick={() => open(p.id)}
                >
                  <span className={styles.tile} aria-hidden>{m.icon}</span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTitle} style={{ display: "block" }}>{highlight(p.title, term)}</span>
                    {p.summary ? <span className={styles.itemSummary}>{p.summary}</span> : null}
                    <span className={styles.itemMeta}>
                      <span>{m.label}</span>
                      <span>{p.steps.length} steps</span>
                      {p.siteIds.length ? <span><EnvironmentOutlined /> {siteLabel(p)}</span> : null}
                      {stepHits ? <span style={{ color: nectarColors.alert, fontWeight: 600 }}>{stepHits} step{stepHits > 1 ? "s" : ""} match</span> : null}
                    </span>
                  </span>
                  <span className={styles.itemChevron} aria-hidden><RightOutlined /></span>
                </button>
              );
            })}
          </nav>

          <ProtocolReader
            protocol={selected}
            q={q.trim()}
            siteLabel={siteLabel(selected)}
            canEdit={canEdit}
            onBack={() => setView("list")}
            onEdit={() => setEditing(selected)}
            onDelete={() => remove(selected)}
            onCopy={() => copyLink(selected.id)}
          />
        </div>
      ) : null}

      <ProtocolEditor
        open={Boolean(editing)}
        protocol={editing && editing !== "new" ? editing : null}
        categories={(rows ?? []).map((r) => r.category)}
        sites={dir.sites.map((s) => ({ id: s.id, name: s.name }))}
        saving={saving}
        onSave={save}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function ProtocolReader({
  protocol: p,
  q,
  siteLabel,
  canEdit,
  onBack,
  onEdit,
  onDelete,
  onCopy,
}: {
  protocol: SafetyProtocol;
  q: string;
  siteLabel: string;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const m = categoryMeta(p.category);
  return (
    <article className={styles.reader} style={{ ["--accent" as string]: m.color }} aria-labelledby="protocol-title">
      <header className={styles.readerHead}>
        <div className={styles.back}>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ paddingInline: 0 }}>
            All protocols
          </Button>
        </div>
        <div className={styles.readerTop}>
          <span className={styles.tile} aria-hidden>{m.icon}</span>
          <div className={styles.readerTitleBox}>
            <div className={styles.kicker}>{m.label} · emergency protocol</div>
            <h1 id="protocol-title" className={styles.readerTitle}>{p.title}</h1>
          </div>
        </div>
        {p.summary ? <p className={styles.readerSummary}>{highlight(p.summary, q)}</p> : null}
        <div className={styles.readerMeta}>
          <span><EnvironmentOutlined /> {siteLabel}</span>
          <span>Version {p.version}</span>
          <span>
            Updated by {p.updatedBy ?? "—"}
            {p.updatedAtIso ? ` · ${new Date(p.updatedAtIso).toLocaleDateString("en-IN", { dateStyle: "medium" })}` : ""}
          </span>
        </div>
        <div className={styles.readerActions}>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print for notice board</Button>
          <Button icon={<LinkOutlined />} onClick={onCopy}>Copy link</Button>
          {canEdit ? <Button icon={<EditOutlined />} onClick={onEdit}>Edit</Button> : null}
          {canEdit ? <Button danger icon={<DeleteOutlined />} onClick={onDelete}>Delete</Button> : null}
        </div>
      </header>

      <div className={styles.readerBody}>
        <section aria-labelledby="steps-title">
          <h2 id="steps-title" className={styles.sectionTitle}>What to do</h2>
          {p.steps.length ? (
            <ol className={styles.steps}>
              {p.steps.map((s, i) => (
                <li key={i} className={`${styles.step} ${i === 0 ? styles.stepFirst : ""}`}>
                  <span className={styles.stepNo} aria-hidden>{i + 1}</span>
                  <div>
                    {i === 0 ? <span className={styles.firstLabel}>Do this first</span> : null}
                    <p className={styles.stepText} style={i === 0 ? { marginTop: 0 } : undefined}>{highlight(s, q)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p style={{ color: nectarColors.muted }}>No steps written yet.</p>
          )}
        </section>

        {p.emergencyContacts.length ? (
          <section aria-labelledby="contacts-title">
            <h2 id="contacts-title" className={styles.sectionTitle}>Who to call</h2>
            <div className={styles.contacts}>
              {p.emergencyContacts.map((c) => (
                <a key={c.label + c.phone} href={`tel:${c.phone.replace(/\s+/g, "")}`} className={styles.contact}>
                  <PhoneFilled aria-hidden />
                  <span>
                    <span className={styles.contactNumber}>{c.phone}</span>
                    <span className={styles.contactLabel}>{c.label}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <div className={styles.readerActions} style={{ marginTop: 0 }}>
          <Link href="/safety/report"><Button type="primary" icon={<AlertOutlined />}>Report what happened</Button></Link>
          <Link href="/safety/training"><Button>Safety training</Button></Link>
        </div>
      </div>
    </article>
  );
}

export default function SafetyProtocolsPage() {
  return (
    <Suspense fallback={null}>
      <ProtocolsView />
    </Suspense>
  );
}
