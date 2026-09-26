/**
 * Training status overrides — localStorage-backed for demo.
 */

import { trainingItems, employees, type TrainingItem } from "@/lib/mock-data";

const TRAINING_STORAGE_KEY = "nectar-enviro-training-status-v1";

type StatusOverride = Partial<
  Record<string, TrainingItem["status"]>
>;

function readOverrides(): StatusOverride {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TRAINING_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StatusOverride;
  } catch {
    return {};
  }
}

function writeOverrides(map: StatusOverride) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(map));
}

export function getTrainingItems(opts?: {
  employeeId?: string;
  siteEmployeeIds?: string[];
}): TrainingItem[] {
  const overrides = readOverrides();
  return trainingItems
    .map((t) =>
      overrides[t.id] ? { ...t, status: overrides[t.id]! } : { ...t },
    )
    .filter((t) => {
      if (opts?.employeeId) return t.employeeId === opts.employeeId;
      if (opts?.siteEmployeeIds) {
        return opts.siteEmployeeIds.includes(t.employeeId);
      }
      return true;
    });
}

export function markTrainingCompleted(id: string) {
  const map = readOverrides();
  map[id] = "completed";
  writeOverrides(map);
}

export function resetTrainingStatus(id: string) {
  const map = readOverrides();
  delete map[id];
  writeOverrides(map);
}

export function getUrgentTrainingItems(siteId?: string): TrainingItem[] {
  return getTrainingItems()
    .filter((t) => t.status === "overdue" || t.status === "due-soon")
    .filter((t) => {
      if (!siteId) return true;
      const emp = employees.find((e) => e.id === t.employeeId);
      return emp?.siteId === siteId;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
