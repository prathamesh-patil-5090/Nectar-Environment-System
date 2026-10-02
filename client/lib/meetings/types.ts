// Meetings module — placeholder types (feature coming soon).

export type MeetingStatus = "scheduled" | "completed" | "cancelled";

export type Meeting = {
  id: string;
  title: string;
  agenda?: string;
  siteId?: string;
  organizerId: string;
  attendeeIds: string[];
  startAt: string; // ISO
  endAt: string; // ISO
  location?: string;
  status: MeetingStatus;
};
