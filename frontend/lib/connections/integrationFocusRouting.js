/**
 * URL focus deep-link helpers for the integrations setup dialog.
 */

export function shouldOpenIntegrationFromFocus({
  focus,
  setupTarget,
  consumedFocus,
  primary,
  isConnected,
}) {
  if (!focus || setupTarget) return null;
  if (consumedFocus === focus) return null;

  const match = primary.find(({ display }) => display.id === focus);
  if (!match) return null;
  if (isConnected(match.conn.status)) return null;

  return match.display;
}

export function buildPathWithoutFocus(pathname, searchParams) {
  const path = String(pathname ?? "");
  const focus = searchParams?.get?.("focus");
  if (!focus) return path;

  const next = new URLSearchParams(searchParams.toString());
  next.delete("focus");
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}
