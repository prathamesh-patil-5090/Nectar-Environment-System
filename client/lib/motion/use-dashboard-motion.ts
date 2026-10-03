"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

const MOTION_OK = "(prefers-reduced-motion: no-preference)";

const pick = (root: HTMLElement, selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));

/**
 * Dashboard motion, played once when `ready` turns true:
 * - `[data-anim='intro']` blocks ease up and in, one after another;
 * - cards inside `.nectar-dash-grid` / `.nectar-employee-grid` follow with a short stagger;
 * - `[data-anim='bar']` fills grow from 0 to their width;
 * - `[data-count]` numbers count up from 0 to their value (integers only; the final text is always restored).
 * Skipped entirely for users who ask for reduced motion.
 */
export function useDashboardMotion(ready: boolean) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!ready || !root) return;
    const counters: { el: HTMLElement; final: string }[] = [];
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      const intro = pick(root, "[data-anim='intro']");
      if (intro.length) {
        tl.from(intro, { opacity: 0, y: 12, duration: 0.5, stagger: 0.07, clearProps: "transform" }, 0);
      }

      const cards = pick(root, ".nectar-dash-grid > *, .nectar-employee-grid > *");
      if (cards.length) {
        tl.from(cards, { opacity: 0, y: 10, duration: 0.45, stagger: 0.06, clearProps: "transform" }, 0.15);
      }

      const bars = pick(root, "[data-anim='bar']");
      if (bars.length) {
        tl.from(bars, { width: 0, duration: 0.9, ease: "power3.out", stagger: 0.05 }, 0.3);
      }

      for (const el of pick(root, "[data-count]")) {
        const target = Number(el.dataset.count);
        if (!Number.isFinite(target) || target <= 0) continue;
        const final = el.textContent ?? String(target);
        counters.push({ el, final });
        const state = { v: 0 };
        el.textContent = "0";
        tl.to(
          state,
          {
            v: target,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = String(Math.round(state.v));
            },
            onComplete: () => {
              el.textContent = final;
            },
          },
          0.2,
        );
      }
    });

    return () => {
      mm.revert();
      // A revert mid-count (fast navigation, React strict mode) must not leave a half-counted number behind
      for (const { el, final } of counters) el.textContent = final;
    };
  }, [ready]);

  return rootRef;
}
