import {
  getEmployeeSkills,
  getSiteById,
  type Employee,
  type PlantType,
  type SkillKey,
} from "@/lib/mock-data";
import type { SkillTag } from "@/lib/reliever/pool";
import type { ShiftCode } from "@/lib/shift/types";

const SKILL_KEY_TO_TAG: Partial<Record<SkillKey, SkillTag>> = {
  etpOps: "ETP Ops",
  roOps: "RO Ops",
  safety: "Safety",
  sampling: "Sampling",
  maintenance: "Maintenance",
};

const PLANT_TO_TAG: Record<PlantType, SkillTag> = {
  ETP: "ETP Ops",
  STP: "STP Ops",
  WTP: "WTP Ops",
  RO: "RO Ops",
  MEE: "MEE Ops",
};

const SKILL_THRESHOLD = 60;

/** Map role skill matrix + home plant into operational SkillTags. */
export function employeeSkillTags(emp: Employee): SkillTag[] {
  const scores = getEmployeeSkills(emp);
  const tags: SkillTag[] = [];
  for (const key of Object.keys(SKILL_KEY_TO_TAG) as SkillKey[]) {
    const tag = SKILL_KEY_TO_TAG[key];
    if (tag && (scores[key] ?? 0) >= SKILL_THRESHOLD) {
      tags.push(tag);
    }
  }
  const site = getSiteById(emp.siteId);
  if (site) {
    tags.push(PLANT_TO_TAG[site.plantType]);
  }
  if (
    emp.shiftId === "sh-general" ||
    emp.employeeCategory === "general" ||
    emp.role.toLowerCase().includes("general")
  ) {
    tags.push("General Shift");
  }
  return [...new Set(tags)];
}

/** Skills needed to cover a vacancy at a plant/shift. */
export function inferRequiredSkills(
  siteId: string,
  shiftCode: ShiftCode | string,
): SkillTag[] {
  const site = getSiteById(siteId);
  const tags: SkillTag[] = [];
  if (site) {
    tags.push(PLANT_TO_TAG[site.plantType]);
  }
  tags.push("Safety");
  if (shiftCode === "G") {
    tags.push("General Shift");
  }
  return [...new Set(tags)];
}

export function skillsMatch(
  candidateSkills: SkillTag[],
  required: SkillTag[],
): boolean {
  if (!required.length) return true;
  const plantOps = required.filter((s) => s.endsWith("Ops"));
  if (plantOps.length) {
    return plantOps.some((s) => candidateSkills.includes(s));
  }
  return required.some((s) => candidateSkills.includes(s));
}

export function skillMatchScore(
  candidateSkills: SkillTag[],
  required: SkillTag[],
): number {
  if (!required.length) return 1;
  return required.filter((s) => candidateSkills.includes(s)).length;
}
