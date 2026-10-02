"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./training.module.css";
import { useIsMentor, useViewer } from "@/lib/training/hooks";

type Item = { href: string; label: string; match: (p: string) => boolean };

/** Training section navigation (Coursera-style). */
export default function TrainingSubNav() {
  const pathname = usePathname() ?? "";
  const viewer = useViewer();
  const isMentor = useIsMentor(viewer.personId);
  const hasTeam = ["supervisor", "shift_incharge", "site_incharge"].includes(viewer.role);

  const items: Item[] = [
    viewer.isRecords
      ? { href: "/training", label: "Records", match: (p) => p === "/training" }
      : { href: "/training", label: "Home", match: (p) => p === "/training" },
    ...(viewer.isRecords ? [{ href: "/training/home", label: "My learning home", match: (p: string) => p === "/training/home" }] : []),
    { href: "/training/explore", label: "Explore", match: (p) => p.startsWith("/training/explore") || p.startsWith("/training/course") },
    { href: "/training/my-learning", label: "My Learning", match: (p) => p.startsWith("/training/my-learning") },
    ...(hasTeam ? [{ href: "/training/team", label: "My Team", match: (p: string) => p.startsWith("/training/team") }] : []),
    ...(isMentor ? [{ href: "/training/mentor", label: "Mentor Studio", match: (p: string) => p.startsWith("/training/mentor") }] : []),
  ];

  return (
    <nav aria-label="Training" className={styles.nav}>
      {items.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
