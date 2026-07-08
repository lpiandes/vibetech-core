export function channelPermissionLabel(guidance: { permitted?: boolean; reason?: string | null } | null | undefined) {
  if (guidance?.permitted) return "not blocked";
  return `blocked (${guidance?.reason ?? "not permitted"})`;
}
