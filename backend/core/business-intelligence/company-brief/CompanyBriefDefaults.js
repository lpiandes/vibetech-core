export const COMPANY_BRIEF_VERSION = 1;

export const SECTION_IDS = {
  COMPANY_PULSE: "company_pulse",
  PRIORITIES: "today_priorities",
  DECISIONS_WAITING: "decisions_waiting",
  DIGITAL_WORKFORCE: "digital_workforce",
  RECENT_ACTIVITY: "recent_activity",
  RISKS: "risks",
  OPPORTUNITIES: "opportunities",
  RECOMMENDATIONS: "recommendations",
};

export const SECTION_ORDER = [
  SECTION_IDS.COMPANY_PULSE,
  SECTION_IDS.PRIORITIES,
  SECTION_IDS.DECISIONS_WAITING,
  SECTION_IDS.DIGITAL_WORKFORCE,
  SECTION_IDS.RECENT_ACTIVITY,
  SECTION_IDS.RISKS,
  SECTION_IDS.OPPORTUNITIES,
  SECTION_IDS.RECOMMENDATIONS,
];

export function greetingForNowISO() {
  // Deterministic greeting for Sprint 4 foundation.
  return "Good morning.";
}

