"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsMentor, useViewer } from "@/lib/training/hooks";

type Item = { href: string; label: string; match: (p: string) => boolean };

/** Training section navigation: pill tabs, the active one in the theme navy. */
export default function TrainingSubNav() {
  const pathname = usePathname() ?? "";
  const viewer = useViewer();
  const isMentor = useIsMentor(viewer.personId);
  const hasTeam = ["supervisor", "shift_incharge", "site_incharge"].includes(viewer.role);
  const inStudio = (p: string) => p === "/training/mentor" || p.startsWith("/training/mentor/");

  const items: Item[] = [
    viewer.isRecords
      ? { href: "/training", label: "Records", match: (p) => p === "/training" }
      : { href: "/training", label: "Home", match: (p) => p === "/training" },
    ...(viewer.isRecords ? [{ href: "/training/home", label: "My learning home", match: (p: string) => p === "/training/home" }] : []),
    { href: "/training/explore", label: "Explore", match: (p) => p.startsWith("/training/explore") || p.startsWith("/training/course") },
    { href: "/training/my-learning", label: "My Learning", match: (p) => p.startsWith("/training/my-learning") },
    ...(hasTeam ? [{ href: "/training/team", label: "My Team", match: (p: string) => p.startsWith("/training/team") }] : []),
    ...(isMentor ? [{ href: "/training/mentor", label: "Mentor Studio", match: inStudio }] : []),
  ];

  return (
    <nav aria-label="Training" className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
      {items.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors border ${
              active
                ? "bg-[#1C4463]! border-[#1C4463] text-white!"
                : "bg-white! border-slate-200 text-slate-600! hover:border-[#1C4463] hover:text-[#1C4463]!"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
