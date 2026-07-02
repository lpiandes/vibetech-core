export const WORK_VIEW_VERSION = 1;

// Attention categories are canonical and should be stable over time.
export const ATTENTION_CATEGORIES = [
  "blocked_work",
  "failed_work",
  "overdue_work",
  "review_required_work",
  "unassigned_work",
  "work_waiting_too_long",
  "queues_growing_too_large",
  "missing_assignees",
];

export const ACTION_PRIORITIES = ["immediate", "soon", "later"];

export const ACTION_STYLE_BY_PRIORITY = {
  immediate: "danger",
  soon: "warning",
  later: "neutral",
};

// Actions are business actions, not UI events.
export const ACTION_TYPES = {
  review_work: "review_work",
  assign_work: "assign_work",
  unblock_work: "unblock_work",
  approve_work: "approve_work",
  reject_work: "reject_work",
  complete_work: "complete_work",
  view_queue: "view_queue",
  view_assignee: "view_assignee",
  follow_up: "follow_up",
};

