export const CAPABILITY_PROVIDER_TYPES = ["human", "digital_employee", "automation", "external_system"];

export const MATCH_SCORING = {
  exactCapabilityMatchWeight: 40,
  categoryMatchWeight: 25,
  providerAvailabilityWeight: 20,
  workloadPenaltyWeight: 20,
};

export const AVAILABILITY_SCORE = {
  available: 20,
  busy: 10,
  away: 7,
  offline: 3,
  blocked: 0,
};

export const WORKLOAD_PENALTY_THRESHOLDS = {
  highUtilization: 70,
  severeUtilization: 90,
};

