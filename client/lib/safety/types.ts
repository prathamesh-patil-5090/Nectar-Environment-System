import type {
  ClearanceStatus,
  SafetyCategory,
  SafetyEventType,
  SafetySeverity,
  SafetyStatus,
} from "./rules";

export type {
  ClearanceStatus,
  SafetyCategory,
  SafetyEventType,
  SafetySeverity,
  SafetyStatus,
} from "./rules";

/** Mirrors server/db/schemas/safety-event.schema.ts */
export type SafetyPersonRef = { personId: string; name: string; role: string };

export type SafetyTimelineEntry = {
  at: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  kind:
    | "created"
    | "status"
    | "comment"
    | "action"
    | "clearance"
    | "leave"
    | "call"
    | "media"
    | "notify"
    | "edit"
    | "promote";
  title: string;
  detail?: string;
};

export type SafetyCorrectiveAction = {
  id: string;
  text: string;
  ownerId?: string;
  dueDate?: string;
  done: boolean;
  doneAt?: string;
  doneBy?: string;
};

export type SafetyClearance = {
  employeeId: string;
  status: ClearanceStatus;
  clearedBy?: string;
  clearedByRole?: string;
  at?: string;
  remark?: string;
};

export type SafetyMedia = {
  id: string;
  url: string;
  kind: "image" | "video";
  name: string;
  size: number;
  uploadedBy: string;
  at: string;
};

export type SafetyOtEntry = { employeeId: string; hours: number; date?: string; otDecisionId?: string };

export type SafetyEvent = {
  id: string;
  type: SafetyEventType;
  siteId: string;
  title: string;
  description: string;
  location: string;
  occurredAt: string;
  reportedAt: string;
  category: SafetyCategory;
  /** Custom hazard name when category is "other". */
  categoryOther?: string;
  severity: SafetySeverity;
  status: SafetyStatus;
  reportedBy: SafetyPersonRef;
  informedBy: string[];
  involved: string[];
  stakeholders: SafetyPersonRef[];
  media: SafetyMedia[];
  rootCause: string;
  correctiveActions: SafetyCorrectiveAction[];
  timeline: SafetyTimelineEntry[];
  isEmergency: boolean;
  emergencyRecipients: string[];
  emergencyAcks: string[];
  meetLink?: string;
  /** Safety meeting: when it was called, who was called and who joined */
  callStartedAt?: string;
  callInvited?: string[];
  callJoined?: string[];
  callNudgedAt?: Record<string, string>;
  lastNotifiedAt?: string;
  notifyCount: number;
  escalatedAt?: string | null;
  promotedFrom?: string;
  promotedTo?: string;
  linkedLeaveIds: string[];
  requiresReturnClearance: boolean;
  clearance: SafetyClearance[];
  equipment?: string;
  whatFailed?: string;
  why?: string;
  how?: string;
  failedAt?: string;
  restoredAt?: string | null;
  otEntries: SafetyOtEntry[];
  otDecisionIds: string[];
};

export type SafetyProtocol = {
  id: string;
  title: string;
  category: string;
  summary: string;
  steps: string[];
  emergencyContacts: { label: string; phone: string }[];
  siteIds: string[];
  version: number;
  updatedBy?: string;
  updatedAtIso?: string;
  archivedAt?: string;
  archivedBy?: string;
};

export type PendingClearance = { eventId: string; title: string; siteId: string; employeeId: string };

/** Who is acting — sent with every write; checked server-side by role + site. */
export type SafetyActor = { id: string; name: string; role: string; siteId?: string };

export type NewSafetyEventInput = {
  type: SafetyEventType;
  siteId: string;
  title: string;
  description?: string;
  location?: string;
  occurredAt?: string;
  category?: SafetyCategory;
  categoryOther?: string;
  severity?: SafetySeverity;
  involved?: string[];
  informedBy?: string[];
  isEmergency?: boolean;
  equipment?: string;
  whatFailed?: string;
  why?: string;
  how?: string;
  failedAt?: string;
  restoredAt?: string;
};
