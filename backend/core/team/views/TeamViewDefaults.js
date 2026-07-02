export const TEAM_VIEW_VERSION = 1;

export const TEAM_MEMBER_STATUS_BADGE = {
  blocked: "Blocked",
  offline: "Offline",
  away: "Away",
  busy: "Busy",
  available: "Available",
};

export const ATTENTION_CATEGORIES = [
  "blocked_members",
  "overloaded_members",
  "offline_critical_members",
  "pending_approvals",
  "failed_communications",
  "work_waiting_too_long",
  "departments_no_active_coverage",
];

export const ACTION_PRIORITIES = ["immediate", "soon", "later"];

export const ACTION_STYLE_BY_PRIORITY = {
  immediate: "danger",
  soon: "warning",
  later: "neutral",
};

export const ACTIONS = {
  review_member_work: "review_member_work",
  view_department: "view_department",
  rebalance_workload: "rebalance_workload",
  review_pending_approvals: "review_pending_approvals",
  investigate_blocker: "investigate_blocker",
  assign_work: "assign_work",
  hire_employee: "hire_employee",
};

