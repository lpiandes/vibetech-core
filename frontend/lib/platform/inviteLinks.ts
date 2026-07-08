export function resolveInviteUrl(inviteUrl: string) {
  if (inviteUrl.startsWith("http://") || inviteUrl.startsWith("https://")) return inviteUrl;
  if (typeof window === "undefined") return inviteUrl;
  return `${window.location.origin}${inviteUrl.startsWith("/") ? "" : "/"}${inviteUrl}`;
}

export async function copyInviteLink(inviteUrl: string) {
  await navigator.clipboard.writeText(resolveInviteUrl(inviteUrl));
}
