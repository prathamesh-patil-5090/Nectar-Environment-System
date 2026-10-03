import { apiClient } from './client';
import type {
  NewSafetyEventInput,
  PendingClearance,
  SafetyActor,
  SafetyEvent,
  SafetyProtocol,
  SafetyStatus,
} from '../safety/types';

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
const viewerQuery = (v: SafetyActor) => ({ viewerId: v.id, viewerRole: v.role, viewerSiteId: v.siteId });

export const listSafetyEvents = (
  viewer: SafetyActor,
  filter: { siteId?: string; type?: string; status?: string; employeeId?: string } = {},
) => apiClient<SafetyEvent[]>(`/safety/events${q({ ...filter, ...viewerQuery(viewer) })}`);

export const getSafetyEvent = (id: string, viewer: SafetyActor) =>
  apiClient<SafetyEvent>(`/safety/events/${enc(id)}${q(viewerQuery(viewer))}`);

export const createSafetyEvent = (actor: SafetyActor, input: NewSafetyEventInput) =>
  send<SafetyEvent>('POST', '/safety/events', { ...input, actor });

export const updateSafetyEvent = (id: string, actor: SafetyActor, patch: Record<string, unknown>) =>
  send<SafetyEvent>('PATCH', `/safety/events/${enc(id)}`, { ...patch, actor });

export const changeSafetyStatus = (id: string, actor: SafetyActor, status: SafetyStatus, remark?: string) =>
  send<SafetyEvent>('PATCH', `/safety/events/${enc(id)}/status`, { actor, status, remark });

export const commentSafetyEvent = (id: string, actor: SafetyActor, text: string) =>
  send<SafetyEvent>('POST', `/safety/events/${enc(id)}/comments`, { actor, text });

export const addSafetyAction = (
  id: string,
  actor: SafetyActor,
  action: { text: string; ownerId?: string; dueDate?: string },
) => send<SafetyEvent>('POST', `/safety/events/${enc(id)}/actions`, { ...action, actor });

export const setSafetyActionDone = (id: string, actionId: string, actor: SafetyActor, done: boolean) =>
  send<SafetyEvent>('PATCH', `/safety/events/${enc(id)}/actions/${enc(actionId)}`, { actor, done });

export const promoteNearMiss = (
  id: string,
  actor: SafetyActor,
  opts: { category?: string; categoryOther?: string; severity?: string; title?: string; remark?: string; isEmergency?: boolean },
) => send<SafetyEvent>('POST', `/safety/events/${enc(id)}/promote`, { ...opts, actor });

export const decideSafetyClearance = (
  id: string,
  employeeId: string,
  actor: SafetyActor,
  decision: 'cleared' | 'waived',
  remark?: string,
) => send<SafetyEvent>('POST', `/safety/events/${enc(id)}/clearance/${enc(employeeId)}`, { actor, decision, remark });

export const linkSafetyLeave = (id: string, actor: SafetyActor, leaveId: string) =>
  send<SafetyEvent>('POST', `/safety/events/${enc(id)}/link-leave`, { actor, leaveId });

export const startSafetyCall = (id: string, actor: SafetyActor) =>
  send<SafetyEvent>('POST', `/safety/events/${enc(id)}/call`, { actor });

export const joinSafetyCall = (id: string, actor: SafetyActor) =>
  send<SafetyEvent>('POST', `/safety/events/${enc(id)}/call/join`, { actor });

export const ackSafetyEmergency = (id: string, actor: SafetyActor) =>
  send<SafetyEvent>('POST', `/safety/events/${enc(id)}/ack-emergency`, { actor });

export const getActiveEmergencies = (personId: string) =>
  apiClient<SafetyEvent[]>(`/safety/emergencies/active${q({ personId })}`);

export const getPendingClearances = (employeeId?: string) =>
  apiClient<PendingClearance[]>(`/safety/clearance/pending${q({ employeeId })}`);

export const listSafetyProtocols = (siteId?: string) =>
  apiClient<SafetyProtocol[]>(`/safety/protocols${q({ siteId })}`);

export const createSafetyProtocol = (actor: SafetyActor, protocol: Partial<SafetyProtocol>) =>
  send<SafetyProtocol>('POST', '/safety/protocols', { ...protocol, actor });

export const updateSafetyProtocol = (id: string, actor: SafetyActor, patch: Partial<SafetyProtocol>) =>
  send<SafetyProtocol>('PATCH', `/safety/protocols/${enc(id)}`, { ...patch, actor });

/** Soft delete — the protocol is archived and hidden from sites. */
export const deleteSafetyProtocol = (id: string, actor: SafetyActor) =>
  send<SafetyProtocol>('DELETE', `/safety/protocols/${enc(id)}`, { actor });

/** Absolute URL for an uploaded photo / video (server returns a path under /api). */
export const safetyMediaUrl = (url: string) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

/** Multipart upload — photo ≤10 MB, video ≤50 MB. */
export async function uploadSafetyMedia(id: string, actor: SafetyActor, file: File): Promise<SafetyEvent> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('actor', JSON.stringify(actor));
  const res = await fetch(`${API_BASE_URL}/safety/events/${enc(id)}/media`, { method: 'POST', body: fd });
  if (!res.ok) {
    let msg = `Upload failed: ${res.status}`;
    try {
      const err = await res.json();
      if (err?.message) msg = Array.isArray(err.message) ? err.message.join(', ') : err.message;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}
