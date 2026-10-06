"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsMentor, useViewer } from "@/lib/training/hooks";
import { useT, trData } from "@/lib/i18n";

type Item = { href: string; label: string; match: (p: string) => boolean };

/** Training section navigation: pill tabs, the active one in the theme navy. */
export default function TrainingSubNav() {
  const pathname = usePathname() ?? "";
  const viewer = useViewer();
  const isMentor = useIsMentor(viewer.personId);
  const hasTeam = ["supervisor", "shift_incharge", "site_incharge"].includes(viewer.role);
  const inStudio = (p: string) => p === "/training/mentor" || p.startsWith("/training/mentor/");
  const t = useT();

  const items: Item[] = [
    viewer.isRecords
      ? { href: "/training", label: t("training.records"), match: (p) => p === "/training" }
      : { href: "/training", label: t("training.home"), match: (p) => p === "/training" },
    ...(viewer.isRecords
      ? [{ href: "/training/home", label: t("training.myLearningHome"), match: (p: string) => p === "/training/home" }]
      : []),
    {
      href: "/training/explore",
      label: t("training.explore"),
      match: (p) => p.startsWith("/training/explore") || p.startsWith("/training/course"),
    },
    {
      href: "/training/my-learning",
      label: t("training.myLearning"),
      match: (p) => p.startsWith("/training/my-learning"),
    },
    ...(hasTeam
      ? [{ href: "/training/team", label: t("training.myTeam"), match: (p: string) => p.startsWith("/training/team") }]
      : []),
    ...(isMentor
      ? [{ href: "/training/mentor", label: t("training.mentorStudio"), match: inStudio }]
      : []),
  ];

  return (
    <nav aria-label={t("nav.training")} className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
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
            {trData(it.label)}
          </Link>
        );
      })}
    </nav>
  );
}
