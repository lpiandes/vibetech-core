export const REQUEST_VIEW_VERSION = 1;

export const ATTENTION_CATEGORIES = [
  "new_unreviewed_requests",
  "high_priority_requests",
  "overdue_requests",
  "qualified_not_converted",
  "missing_assignment",
  "failed_blocked_related_work",
  "requests_waiting_too_long",
  "conversion_backlog",
];

export const ACTION_PRIORITIES = ["immediate", "soon", "later"];

export const ACTION_STYLE_BY_PRIORITY = {
  immediate: "danger",
  soon: "warning",
  later: "neutral",
};

// Actions are business actions (not UI logic).
export const ACTION_TYPES = {
  review_request: "review_request",
  qualify_request: "qualify_request",
  reject_request: "reject_request",
  convert_to_work: "convert_to_work",
  assign_request: "assign_request",
  view_related_work: "view_related_work",
  follow_up: "follow_up",
  close_request: "close_request",
};

export const DEFAULT_REQUEST_QUEUES = [
  { id: "queue_new_requests", name: "New Requests", type: "new_requests", priority: "immediate", status: "open" },
  { id: "queue_needs_review", name: "Needs Review", type: "needs_review", priority: "immediate", status: "open" },
  { id: "queue_qualified", name: "Qualified", type: "qualified", priority: "soon", status: "open" },
  { id: "queue_ready_to_convert", name: "Ready to Convert", type: "ready_to_convert", priority: "soon", status: "open" },
  { id: "queue_converted", name: "Converted", type: "converted", priority: "later", status: "open" },
  { id: "queue_closed", name: "Closed", type: "closed", priority: "later", status: "completed" },
];

