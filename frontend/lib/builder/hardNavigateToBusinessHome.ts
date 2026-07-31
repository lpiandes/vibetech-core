/**
 * After Architect install, soft client navigations can reuse a stale /b/[id] layout
 * (installedBusinessOS still null → blank chrome / white screen). Always hard-load Home.
 */
export function hardNavigateToBusinessHome(href: string | null | undefined) {
  if (typeof window === "undefined") return;
  const url = String(href ?? "").trim();
  if (!url) return;
  window.location.assign(url);
}
