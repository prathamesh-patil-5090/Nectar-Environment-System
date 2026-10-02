import type { Course, CourseCardData } from "./types";

/** Course → card fields (same shape the server sends in feeds). */
export const toCard = (c: Course): CourseCardData => ({
  id: c.id,
  code: c.code,
  title: c.title,
  description: c.description,
  section: c.section,
  thumbnailUrl: c.thumbnailUrl,
  provider: c.provider,
  rating: c.rating,
  reviewCount: c.reviewCount,
  level: c.level,
  estimatedHours: c.estimatedHours,
  skills: c.skills ?? [],
  abilityCount: c.abilities.length,
  moduleCount: c.modules?.length ?? 0,
  certificateValidityMonths: c.certificateValidityMonths ?? 12,
  type: c.type ?? "course",
});

