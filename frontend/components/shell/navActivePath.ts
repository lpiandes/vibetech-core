import { CANONICAL_REDIRECTS } from "../workspace/canonicalBusinessNavigation";

/** Normalize business-scoped path for nav matching. */
export function resolveActiveNavPath(pathname: string, businessId: string): string {
  const path = String(pathname ?? "").split("?")[0].replace(/\/$/, "") || "/";
  const base = `/b/${encodeURIComponent(businessId)}`;
  if (path === base) return `${base}/home`;

  const rest = path.startsWith(`${base}/`) ? path.slice(base.length + 1) : "";
  const first = rest.split("/")[0] ?? "";
  const redirected = first ? CANONICAL_REDIRECTS[first] : null;
  if (redirected) return `${base}/${redirected}`;
  return path;
}

/**
 * Pick exactly one active nav item — longest href match wins.
 * Architect / Ask is not a primary tab (handled by Ask entry).
 * Specialty AI aliases: /specialty/owner_emp_x ≡ /specialty/specialty_ai_owner_emp_x
 */
export function findActiveNavHref(
  pathname: string,
  businessId: string,
  hrefs: string[],
): string | null {
  const path = resolveActiveNavPath(pathname, businessId);
  if (/\/architect(?:\/|$)/.test(path)) return null;

  const specialtyAliases = expandSpecialtyPathAliases(path);

  let best: string | null = null;
  for (const href of hrefs) {
    const target = href.replace(/\/$/, "");
    const isHome = target.endsWith("/home");
    const targetAliases = expandSpecialtyPathAliases(target);
    const matches = isHome
      ? path === target || path === `/b/${encodeURIComponent(businessId)}`
      : specialtyAliases.some((candidate) =>
        targetAliases.some((alias) => candidate === alias || candidate.startsWith(`${alias}/`)),
      );
    if (!matches) continue;
    if (!best || target.length > best.length) best = href;
  }
  return best;
}

function expandSpecialtyPathAliases(path: string): string[] {
  const normalized = String(path ?? "").replace(/\/$/, "");
  const match = normalized.match(/^(.*?\/specialty\/)([^/?#]+)$/);
  if (!match) return [normalized];
  const [, prefix, rawId] = match;
  const id = decodeURIComponent(rawId);
  const aliases = new Set<string>([`${prefix}${encodeURIComponent(id)}`, `${prefix}${id}`]);
  if (id.startsWith("specialty_ai_")) {
    const emp = id.slice("specialty_ai_".length);
    aliases.add(`${prefix}${encodeURIComponent(emp)}`);
    aliases.add(`${prefix}${emp}`);
  } else if (id.startsWith("owner_emp_")) {
    aliases.add(`${prefix}${encodeURIComponent(`specialty_ai_${id}`)}`);
    aliases.add(`${prefix}specialty_ai_${id}`);
  }
  return [...aliases];
}
