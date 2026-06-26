export const TRACKED_TENDER_STATUSES = ["tracked", "reviewing", "submitted", "won", "lost"] as const;

export type TrackedTenderStatus = (typeof TRACKED_TENDER_STATUSES)[number];

export const ACTIVE_TRACKED_TENDER_STATUSES: readonly TrackedTenderStatus[] = ["tracked", "reviewing", "submitted"];

export const TRACKED_TENDER_STATUS_LABELS: Record<TrackedTenderStatus, string> = {
  tracked: "Verfolgt",
  reviewing: "In Bearbeitung",
  submitted: "Eingereicht",
  won: "Gewonnen",
  lost: "Verloren",
};

export const TRACKING_EVENT_TYPES = ["shown", "clicked", "pursued", "reviewing", "submitted", "won", "lost"] as const;

export type TrackingEventType = (typeof TRACKING_EVENT_TYPES)[number];

export const mapTrackedStatusToTrackingEvent = (status: TrackedTenderStatus): TrackingEventType => {
  switch (status) {
    case "reviewing":
      return "reviewing";
    case "submitted":
      return "submitted";
    case "won":
      return "won";
    case "lost":
      return "lost";
    case "tracked":
    default:
      return "pursued";
  }
};
