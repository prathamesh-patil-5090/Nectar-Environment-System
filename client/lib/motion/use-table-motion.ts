"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

/** Elements under `root` matching `selector` — GSAP warns when handed an empty list, so callers skip those. */
const pick = (root: HTMLElement | null, selector: string) =>
  root ? Array.from(root.querySelectorAll<HTMLElement>(selector)) : [];

const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/**
 * Shared list-page motion (Sites, Employees):
 * - `[data-anim='intro']` under `pageRef` settles in once on mount;
 * - table rows under `tableRef` stagger in, and `[data-anim='bar']` fills grow from 0, whenever `rowsKey` changes.
 * Pass an empty `rowsKey` while data is loading. Pages that show a spinner first pass `introReady = false` until
 * their content is on screen, so the intro plays on the real content. Skipped entirely for reduced motion.
 */
export function useTableMotion(rowsKey: string, introReady = true) {
  const pageRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!introReady) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const intro = pick(pageRef.current, "[data-anim='intro']");
      if (intro.length) {
        gsap.from(intro, { opacity: 0, y: 10, duration: 0.45, ease: "power2.out", stagger: 0.08, clearProps: "transform" });
      }
    });
    return () => mm.revert();
  }, [introReady]);

  useLayoutEffect(() => {
    if (!rowsKey) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const rows = pick(tableRef.current, "tbody tr.ant-table-row");
      const bars = pick(tableRef.current, "[data-anim='bar']");
      if (rows.length) {
        gsap.from(rows, { opacity: 0, y: 8, duration: 0.35, ease: "power2.out", stagger: 0.04, clearProps: "transform" });
      }
      if (bars.length) {
        gsap.from(bars, { width: 0, duration: 0.7, ease: "power3.out", stagger: 0.04, delay: 0.1 });
      }
    });
    return () => mm.revert();
  }, [rowsKey]);

  return { pageRef, tableRef };
}
