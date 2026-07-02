export const RECOMMENDATION_CATEGORIES = [
  "knowledge",
  "communications",
  "connected_systems",
  "digital_workforce",
  "work_queue",
  "onboarding",
  "business_profile",
  "company_profile",
  "operations",
  "workspace",
  "automation",
];

export const RECOMMENDATION_PRIORITIES = ["immediate", "soon", "later"];

export const RECOMMENDATION_STATUSES = ["open", "blocked", "completed", "not_applicable"];

export const RECOMMENDATION_IMPACT = ["Very Low", "Low", "Medium", "High", "Very High"];

export const RECOMMENDATION_EFFORT = ["Small", "Medium", "Large"];

export const RECOMMENDATION_PRIORITY_RANK = {
  immediate: 0,
  soon: 1,
  later: 2,
};

export const RECOMMENDATION_STATUS_RANK = {
  open: 0,
  blocked: 1,
  completed: 2,
  not_applicable: 3,
};

export const RECOMMENDATION_IMPACT_RANK = {
  "Very High": 0,
  High: 1,
  Medium: 2,
  Low: 3,
  "Very Low": 4,
};

export const RECOMMENDATION_EFFORT_RANK = {
  Small: 0,
  Medium: 1,
  Large: 2,
};

export const INSIGHT_SEVERITY_TO_IMPACT = {
  critical: "Very High",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Very Low",
};

export const OPPORTUNITY_IMPACT_TO_IMPACT = {
  "Very High": "Very High",
  High: "High",
  Medium: "Medium",
  Low: "Low",
  "Very Low": "Very Low",
};

