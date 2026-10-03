import type { ReactNode } from "react";
import { nectarColors } from "@/lib/theme";
import {
  CloudOutlined,
  ExperimentOutlined,
  FireOutlined,
  MedicineBoxOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";

type CategoryMeta = { label: string; color: string; icon: ReactNode };

/** Known protocol categories (all in the theme colour — the icon tells them apart). Any other category (free text from the editor) falls back to a generic look. */
const KNOWN: Record<string, CategoryMeta> = {
  fire: { label: "Fire", color: nectarColors.leaf, icon: <FireOutlined /> },
  chemical: { label: "Chemical", color: nectarColors.leaf, icon: <ExperimentOutlined /> },
  gas: { label: "Gas leak", color: nectarColors.leaf, icon: <CloudOutlined /> },
  electrical: { label: "Electrical", color: nectarColors.leaf, icon: <ThunderboltOutlined /> },
  fall: { label: "Falls & openings", color: nectarColors.leaf, icon: <WarningOutlined /> },
  first_aid: { label: "First aid", color: nectarColors.leaf, icon: <MedicineBoxOutlined /> },
};

export const KNOWN_PROTOCOL_CATEGORIES = Object.keys(KNOWN);

const titleCase = (s: string) =>
  s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());

export function categoryMeta(category: string): CategoryMeta {
  const key = category.trim().toLowerCase();
  return KNOWN[key] ?? { label: titleCase(category) || "General", color: nectarColors.leaf, icon: <SafetyOutlined /> };
}

/** Editor input ("First aid", "fire", "Confined space") → stored key ("first_aid", "fire", "confined_space"). */
export function categoryKey(input: string): string {
  const raw = input.trim().toLowerCase();
  const known = Object.entries(KNOWN).find(([key, m]) => key === raw || m.label.toLowerCase() === raw);
  return known ? known[0] : raw.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
