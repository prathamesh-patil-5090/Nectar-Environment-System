export type ContestKind =
  | "shared_top_pick"
  | "already_assigned"
  | "cross_plant";

export type ContestClaimStatus =
  | "competing"
  | "awarded"
  | "need_alt"
  | "acknowledged";

export type ContestClaim = {
  id: string;
  /** Leave id and/or pool absence id */
  leaveId?: string;
  absenceId?: string;
  vacancyId?: string;
  siteId: string;
  date: string;
  shiftCode?: string;
  shiftId?: string;
  mode?: "planned" | "emergency";
  absentEmployeeName: string;
  requiredSkills: string[];
  alternativeCount: number;
  otHoursIfRejected: number;
  otCostIfRejected: number;
  status: ContestClaimStatus;
  matchScore?: number;
};

export type RelieverContest = {
  id: string;
  kind: ContestKind;
  candidateKind: "employee" | "reliever";
  candidateId: string;
  candidateName: string;
  employeeId?: string;
  claims: ContestClaim[];
  siteIds: string[];
};

export type CompetitionAck = {
  id: string;
  contestId: string;
  leaveId: string;
  candidateId: string;
  actor: string;
  remark: string;
  at: string;
};

export type CompetitionAward = {
  id: string;
  contestId: string;
  winnerLeaveId: string;
  candidateId: string;
  actor: string;
  at: string;
};

export type DetectContestsOpts = {
  from: string;
  to: string;
  siteId?: string;
  /** Top-N ranked candidates that count toward shared contention */
  topN?: number;
};

export type AssignContestGateResult = {
  ok: boolean;
  contested: boolean;
  contest?: RelieverContest;
  reasons: string[];
};
