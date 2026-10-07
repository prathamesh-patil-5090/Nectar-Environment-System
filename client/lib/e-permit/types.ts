import type {
  AckContext,
  AckVia,
  ApprovalKind,
  ApprovalState,
  ChecklistAnswer,
  EPermitCategory,
  EPermitStatus,
  EPermitSubCategory,
  GasKey,
  PermitShiftCode,
  ReturnOutcome,
} from "./rules";

export type {
  AckContext,
  AckVia,
  ApprovalKind,
  ApprovalState,
  ChecklistAnswer,
  EPermitCategory,
  EPermitStatus,
  EPermitSubCategory,
  GasKey,
  PermitShiftCode,
  ReturnOutcome,
} from "./rules";

/** Mirrors server/db/schemas/e-permit.schema.ts */
export type EPermitApproval = {
  kind: ApprovalKind;
  departmentId?: string;
  status: ApprovalState;
  decidedBy?: string;
  decidedByName?: string;
  /** Set when a deputy decided for the HoD. */
  onBehalfOf?: string;
  at?: string;
  remark?: string;
};

export type EPermitGasReading = {
  gas: GasKey;
  value: number;
  unit: string;
  ok: boolean;
  /** 0 = at issue; n = renewal n; -1 = on resume after suspension. */
  round: number;
  by: string;
  byName: string;
  at: string;
};

export type EPermitAck = {
  personId: string;
  personName: string;
  role: "issuer" | "holder" | "worker";
  context: AckContext;
  /** 0 = issue, n = renewal n. */
  round: number;
  via: AckVia;
  by: string;
  at: string;
  lat?: number;
  lng?: number;
};

export type EPermitRenewal = {
  n: number;
  ref: string;
  status: "pending" | "approved" | "rejected";
  shiftCode: PermitShiftCode;
  validFrom: string;
  validTo: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  newIssuerId?: string;
  newHolderId?: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  remark?: string;
};

export type EPermitReturn = {
  outcome: ReturnOutcome;
  note?: string;
  holderAt?: string;
  holderBy?: string;
  holderName?: string;
  issuerAt?: string;
  issuerBy?: string;
  issuerName?: string;
  authoriserAt?: string;
  authoriserBy?: string;
  authoriserName?: string;
  /** Where a send-back returns the permit to. */
  returnedFrom?: "ACTIVE" | "SUSPENDED";
};

export type EPermitTimelineEntry = {
  at: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  kind:
    | "created"
    | "edit"
    | "submit"
    | "approval"
    | "ack"
    | "activate"
    | "gas"
    | "renewal"
    | "warning"
    | "overdue"
    | "suspend"
    | "resume"
    | "return"
    | "override"
    | "ot"
    | "review"
    | "cancel"
    | "lapse";
  title: string;
  detail?: string;
};

export type EPermit = {
  id: string;
  permitNo: string;
  siteId: string;
  locationId: string;
  locationName: string;
  category: EPermitCategory;
  subCategory: EPermitSubCategory;
  status: EPermitStatus;
  emergency: boolean;
  policyVersion: number;

  issuerId: string;
  issuerName: string;
  previousIssuerIds: string[];
  holderId: string;
  workerIds: string[];

  authoriserDepartmentId: string;
  approvals: EPermitApproval[];
  postReviews: EPermitApproval[];
  firstApprovalAt?: string;

  shiftCode: PermitShiftCode;
  windowStart: string;
  windowEnd: string;
  plannedFrom?: string;
  plannedTo?: string;
  validFrom?: string;
  validTo?: string;
  firstValidFrom?: string;
  renewalCount: number;
  renewals: EPermitRenewal[];

  parentPermitId?: string;
  safetyEventId?: string;

  description: string;
  hazardsText: string;
  jsaRef: string;
  safetyMeasures: ChecklistAnswer[];
  ppe: ChecklistAnswer[];
  customPpe: ChecklistAnswer[];
  fireGas: ChecklistAnswer[];
  certificates: ChecklistAnswer[];
  gasReadings: EPermitGasReading[];

  acks: EPermitAck[];
  returnInfo?: EPermitReturn;
  completedAt?: string;
  actualHours?: number;

  suspension?: { by: string; byName: string; at: string; reason: string; fromStatus: EPermitStatus };
  overrides: { kind: string; by: string; byName: string; remark: string; at: string }[];
  otDecisionIds: string[];

  warnedForValidTo?: string;
  overdueNotifiedFor?: string;
  postReviewEscalatedAt?: string;

  timeline: EPermitTimelineEntry[];
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Department = {
  id: string;
  name: string;
  headUserId: string;
  headName: string;
  deputyUserIds: string[];
  deputyNames: string[];
  siteIds: string[];
  /** HoD marked unavailable until this moment — approval requests also go to deputies. */
  headUnavailableUntil?: string;
};

export type PermitLocation = {
  id: string;
  siteId: string;
  name: string;
  ownerDepartmentId: string;
  tags: string[];
  /** Other departments that run equipment or people here — each clears every permit at this location. */
  concernedDepartmentIds?: string[];
  active: boolean;
};

export type SiteEmergencyContact = {
  id: string;
  siteId: string;
  team: string;
  mobile: string;
  extension?: string;
};

/** Masters the permit pages need: departments, locations, emergency contacts. */
export type EPermitMasters = {
  departments: Department[];
  locations: PermitLocation[];
  contacts: SiteEmergencyContact[];
};

/** Who is acting — sent with every write; checked server-side by role, site and department. */
export type EPermitActor = { id: string; name: string; role: string; siteId?: string };

export type NewEPermitInput = {
  siteId: string;
  locationId: string;
  category: EPermitCategory;
  subCategory: EPermitSubCategory;
  emergency?: boolean;
  shiftCode: PermitShiftCode;
  plannedFrom?: string;
  plannedTo?: string;
  description: string;
  hazardsText?: string;
  jsaRef?: string;
  holderId: string;
  workerIds: string[];
  safetyMeasures: ChecklistAnswer[];
  ppe: ChecklistAnswer[];
  customPpe?: ChecklistAnswer[];
  fireGas: ChecklistAnswer[];
  certificates: ChecklistAnswer[];
  gasReadings?: { gas: GasKey; value: number }[];
  parentPermitId?: string;
  safetyEventId?: string;
};
