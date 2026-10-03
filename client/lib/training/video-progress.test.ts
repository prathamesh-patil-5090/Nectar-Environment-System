/**
 * Course player sync: watch progress is saved in steps (not every second), never goes backwards
 * when server replies arrive out of order, and re-syncs from the server after a rejected write.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Course, CourseEnrollment } from "@/lib/training/types";

const course = {
  id: "c1",
  code: "T-1",
  title: "Test course",
  section: "Test",
  passThreshold: 70,
  abilities: [
    { id: "a1", courseId: "c1", order: 1, title: "One", code: "1.1", description: "", videoDurationMinutes: 10, competencyAreaId: "x", microQuiz: { questions: [], passThreshold: 70 } },
  ],
  skillMappingQuestions: [],
  writtenTestQuestions: [],
} as unknown as Course;

const serverEnrollment = (pct: number): CourseEnrollment => ({
  id: "enr-e1-c1",
  employeeId: "e1",
  courseId: "c1",
  status: "IN_PROGRESS",
  startedAt: "2026-10-01T00:00:00Z",
  abilityProgress: {
    a1: { abilityId: "a1", videoWatchedPct: pct, videoComplete: pct >= 90, readingAcknowledged: false, quizAttempts: 0, quizPassed: false, unlockedAt: "2026-10-01T00:00:00Z" },
  },
  assessments: {},
});

const api = vi.hoisted(() => ({
  getCourses: vi.fn(),
  getEnrollments: vi.fn(),
  getCertificates: vi.fn(async () => []),
  getSessions: vi.fn(async () => []),
  getTrainingAssignments: vi.fn(async () => []),
  enroll: vi.fn(),
  postVideoProgress: vi.fn(),
}));
vi.mock("@/lib/api/training", () => api);
vi.mock("@/lib/api/employees", () => ({ getEmployees: vi.fn(async () => []) }));
vi.mock("@/lib/api/sites", () => ({ getSites: vi.fn(async () => []) }));

let store: typeof import("@/lib/training/store");

beforeAll(async () => {
  (globalThis as { window?: unknown }).window = { dispatchEvent: () => true };
  (globalThis as { CustomEvent?: unknown }).CustomEvent ??= class {
    constructor(public type: string, public init?: unknown) {}
  };
  store = await import("@/lib/training/store");
});

beforeEach(async () => {
  vi.clearAllMocks();
  api.getCourses.mockResolvedValue([course]);
  api.getEnrollments.mockResolvedValue([serverEnrollment(20)]);
  api.postVideoProgress.mockImplementation(async (_e: string, _a: string, pct: number) => serverEnrollment(pct));
  await store.loadTrainingData(true);
});

const watched = () => store.getEnrollment("e1", "c1").abilityProgress.a1.videoWatchedPct;

describe("video progress sync", () => {
  it("saves in 10% steps from what the database already has, not on every tick", () => {
    for (let pct = 20; pct <= 45; pct++) store.updateVideoProgress("enr-e1-c1", "a1", pct);
    expect(api.postVideoProgress.mock.calls.map((c) => c[2])).toEqual([30, 40]);
    expect(watched()).toBe(45);
  });

  it("sends nothing when there is no new progress (opening or pausing at the stored point)", () => {
    store.updateVideoProgress("enr-e1-c1", "a1", 20, { flush: true });
    store.updateVideoProgress("enr-e1-c1", "a1", 5, { flush: true });
    expect(api.postVideoProgress).not.toHaveBeenCalled();
  });

  it("flush saves the latest point on pause / leaving", () => {
    store.updateVideoProgress("enr-e1-c1", "a1", 24);
    store.updateVideoProgress("enr-e1-c1", "a1", 26, { flush: true });
    expect(api.postVideoProgress.mock.calls.map((c) => c[2])).toEqual([26]);
  });

  it("always saves on reaching 90% (that is what unlocks the quiz / completes the lesson)", () => {
    store.updateVideoProgress("enr-e1-c1", "a1", 85);
    api.postVideoProgress.mockClear();
    store.updateVideoProgress("enr-e1-c1", "a1", 90);
    expect(api.postVideoProgress.mock.calls.map((c) => c[2])).toEqual([90]);
  });

  it("an older server reply does not move progress backwards", async () => {
    let release!: () => void;
    api.postVideoProgress.mockImplementationOnce(
      (_e: string, _a: string, pct: number) => new Promise((r) => (release = () => r(serverEnrollment(pct)))),
    );
    store.updateVideoProgress("enr-e1-c1", "a1", 30); // in flight
    store.updateVideoProgress("enr-e1-c1", "a1", 38); // local only
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(watched()).toBe(38);
  });

  it("a rejected save reloads the enrollment from the server", async () => {
    api.postVideoProgress.mockRejectedValueOnce(new Error("Finish the previous ability first"));
    api.enroll.mockResolvedValueOnce(serverEnrollment(20));
    store.updateVideoProgress("enr-e1-c1", "a1", 35);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(api.enroll).toHaveBeenCalledWith("e1", "c1");
    expect(watched()).toBe(20);
  });
});
