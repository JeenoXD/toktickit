// Human-readable labels shared by Lab 4 screens. Badges always show text, never color alone.

export const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

export const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-info text-dark",
  OPEN: "bg-primary",
  IN_PROGRESS: "bg-warning text-dark",
  WAITING_FOR_REQUESTER: "bg-light text-dark border",
  RESOLVED: "bg-success",
  CLOSED: "bg-secondary",
  REOPENED: "bg-danger",
  CANCELLED: "bg-dark",
};

export const PRIORITY_LABELS: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

export const BLOCK_REASON_LABELS: Record<string, string> = {
  NO_OWNER: "needs an owner",
  NO_COMPLETED_ACTION: "needs at least one completed action",
  PLANNED_ACTIONS_OPEN: "planned actions must be completed or cancelled first",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return STATUS_LABELS[status] ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_BADGE[status] ?? "bg-secondary"}`}>{statusLabel(status)}</span>;
}
