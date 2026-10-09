import { apiClient } from './client';
import type {
  Department,
  EPermit,
  EPermitActor,
  EPermitMasters,
  NewEPermitInput,
  PermitLocation,
  ReturnOutcome,
} from '../e-permit/types';
import type { ApprovalKind, GasKey } from '../e-permit/rules';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const enc = encodeURIComponent;
const q = (params: Record<string, string | undefined>) => {
  const s = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${enc(v as string)}`)
    .join('&');
  return s ? `?${s}` : '';
};
const send = <T>(method: string, path: string, body: unknown) =>
  apiClient<T>(path, { method, body: JSON.stringify(body) });

/** Reads are scoped on the server to what this viewer may see. */
const viewerQuery = (v: EPermitActor) => ({ viewerId: v.id, viewerRole: v.role, viewerSiteId: v.siteId });

export type GasReadingIn = { gas: GasKey; value: number };

/** Thrown for a 409 soft block — carries the reasons and whether this user may override. */
export class SoftBlockError extends Error {
  constructor(
    message: string,
    readonly softBlocks: string[],
    readonly canOverride: boolean,
  ) {
    super(message);
    this.name = 'SoftBlockError';
  }
}

/** Submit needs the 409 body (soft blocks), which apiClient flattens into a message. */
async function sendRaw<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data as T;
  const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || `API error: ${res.status}`;
  if (res.status === 409 && Array.isArray(data?.softBlocks)) {
    throw new SoftBlockError(message, data.softBlocks, Boolean(data.canOverride));
  }
  throw new Error(message);
}

export const getEPermitMasters = () => apiClient<EPermitMasters>('/e-permits/masters');

export const listEPermits = (viewer: EPermitActor, filter: { siteId?: string; status?: string; safetyEventId?: string } = {}) =>
  apiClient<EPermit[]>(`/e-permits${q({ ...filter, ...viewerQuery(viewer) })}`);

export const getEPermit = (id: string, viewer: EPermitActor) =>
  apiClient<EPermit>(`/e-permits/${enc(id)}${q(viewerQuery(viewer))}`);

export const createEPermit = (actor: EPermitActor, input: NewEPermitInput) =>
  send<EPermit>('POST', '/e-permits', { ...input, actor });

export const updateEPermitDraft = (id: string, actor: EPermitActor, patch: Partial<NewEPermitInput>) =>
  send<EPermit>('PATCH', `/e-permits/${enc(id)}`, { ...patch, actor });

export const submitEPermit = (id: string, actor: EPermitActor, override?: { remark: string }) =>
  sendRaw<EPermit>(`/e-permits/${enc(id)}/submit`, {
    actor,
    ...(override ? { overrideSoftBlocks: true, overrideRemark: override.remark } : {}),
  });

export const decideEPermitApproval = (
  id: string,
  actor: EPermitActor,
  approval: { kind: ApprovalKind; departmentId?: string },
  decision: 'approve' | 'reject',
  remark?: string,
) => send<EPermit>('POST', `/e-permits/${enc(id)}/decide`, { actor, ...approval, decision, remark });

export const reviseEPermit = (id: string, actor: EPermitActor) =>
  send<EPermit>('POST', `/e-permits/${enc(id)}/revise`, { actor });

export const acknowledgeEPermit = (id: string, actor: EPermitActor, personId?: string, coords?: { lat: number; lng: number }) =>
  send<EPermit>('POST', `/e-permits/${enc(id)}/ack`, { actor, personId, ...(coords ?? {}) });

export const requestEPermitRenewal = (
  id: string,
  actor: EPermitActor,
  input: { newIssuerId?: string; newHolderId?: string; gasReadings?: GasReadingIn[]; remark?: string },
) => send<EPermit>('POST', `/e-permits/${enc(id)}/renewal`, { ...input, actor });

export const decideEPermitRenewal = (id: string, actor: EPermitActor, decision: 'approve' | 'reject', remark?: string) =>
  send<EPermit>('POST', `/e-permits/${enc(id)}/renewal/decide`, { actor, decision, remark });

export const suspendEPermit = (id: string, actor: EPermitActor, reason: string) =>
  send<EPermit>('POST', `/e-permits/${enc(id)}/suspend`, { actor, reason });

export const resumeEPermit = (id: string, actor: EPermitActor, gasReadings?: GasReadingIn[], remark?: string) =>
  send<EPermit>('POST', `/e-permits/${enc(id)}/resume`, { actor, gasReadings, remark });

export const suspendSitePermits = (siteId: string, actor: EPermitActor, reason: string) =>
  send<{ suspended: string[] }>('POST', `/e-permits/sites/${enc(siteId)}/suspend`, { actor, reason });

export const declareEPermitSiteSafe = (id: string, actor: EPermitActor) =>
  send<EPermit>('POST', `/e-permits/${enc(id)}/site-safe`, { actor });

export const returnEPermit = (id: string, actor: EPermitActor, outcome: ReturnOutcome, note?: string) =>
  send<EPermit>('POST', `/e-permits/${enc(id)}/return`, { actor, outcome, note });

export const acceptEPermitReturn = (id: string, actor: EPermitActor, decision: 'accept' | 'send_back', remark?: string) =>
  send<EPermit>('POST', `/e-permits/${enc(id)}/return/accept`, { actor, decision, remark });

export const cancelEPermit = (id: string, actor: EPermitActor, remark: string) =>
  send<EPermit>('POST', `/e-permits/${enc(id)}/cancel`, { actor, remark });

export const postReviewEPermit = (
  id: string,
  actor: EPermitActor,
  review: { kind: ApprovalKind; departmentId?: string },
  decision: 'approve' | 'reject',
  remark?: string,
) => send<EPermit>('POST', `/e-permits/${enc(id)}/post-review`, { actor, ...review, decision, remark });

export const linkEPermitOt = (id: string, actor: EPermitActor, otDecisionId: string, note?: string) =>
  send<EPermit>('POST', `/e-permits/${enc(id)}/ot`, { actor, otDecisionId, note });

export const setDepartmentAvailability = (departmentId: string, actor: EPermitActor, until: string | null) =>
  send<Department>('PATCH', `/e-permits/departments/${enc(departmentId)}/availability`, { actor, until });

/** Director / Plant Manager: the other departments concerned with a location (each clears every permit there). */
export const setLocationDepartments = (locationId: string, actor: EPermitActor, departmentIds: string[]) =>
  send<PermitLocation>('PATCH', `/e-permits/locations/${enc(locationId)}/departments`, { actor, departmentIds });
