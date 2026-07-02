export const TEAM_MEMBER_STATUSES = ["available", "busy", "offline", "away", "blocked"];

export function isValidTeamMemberStatus(status) {
  return TEAM_MEMBER_STATUSES.includes(String(status ?? ""));
}

