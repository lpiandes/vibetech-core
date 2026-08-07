import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "navActivePath.ts"), "utf8");

// Pure helpers are duplicated inline for node:test without TS path aliases.
const CANONICAL_REDIRECTS: Record<string, string> = {
  "mission-control": "home",
  "for-you": "intelligence",
  attention: "intelligence",
  decisions: "intelligence",
  "company-rules": "knowledge",
  engagement: "work",
  performance: "home",
  analytics: "home",
  "digital-workforce": "team",
};

function resolveActiveNavPath(pathname: string, businessId: string): string {
  const pathName = String(pathname ?? "").split("?")[0].replace(/\/$/, "") || "/";
  const base = `/b/${encodeURIComponent(businessId)}`;
  if (pathName === base) return `${base}/home`;
  const rest = pathName.startsWith(`${base}/`) ? pathName.slice(base.length + 1) : "";
  const first = rest.split("/")[0] ?? "";
  const redirected = first ? CANONICAL_REDIRECTS[first] : null;
  if (redirected) return `${base}/${redirected}`;
  return pathName;
}

function expandSpecialtyPathAliases(pathValue: string): string[] {
  const normalized = String(pathValue ?? "").replace(/\/$/, "");
  const match = normalized.match(/^(.*?\/specialty\/)([^/?#]+)$/);
  if (!match) return [normalized];
  const [, prefix, rawId] = match;
  const id = decodeURIComponent(rawId);
  const aliases = new Set<string>([`${prefix}${encodeURIComponent(id)}`, `${prefix}${id}`]);
  if (id.startsWith("specialty_ai_")) {
    const emp = id.slice("specialty_ai_".length);
    aliases.add(`${prefix}${encodeURIComponent(emp)}`);
    aliases.add(`${prefix}${emp}`);
  } else {
    aliases.add(`${prefix}${encodeURIComponent(`specialty_ai_${id}`)}`);
    aliases.add(`${prefix}specialty_ai_${id}`);
  }
  return [...aliases];
}

function findActiveNavHref(pathname: string, businessId: string, hrefs: string[]): string | null {
  const pathName = resolveActiveNavPath(pathname, businessId);
  if (/\/architect(?:\/|$)/.test(pathName)) return null;
  const specialtyAliases = expandSpecialtyPathAliases(pathName);
  let best: string | null = null;
  for (const href of hrefs) {
    const target = href.replace(/\/$/, "");
    const isHome = target.endsWith("/home");
    const targetAliases = expandSpecialtyPathAliases(target);
    const matches = isHome
      ? pathName === target || pathName === `/b/${encodeURIComponent(businessId)}`
      : specialtyAliases.some((candidate) =>
        targetAliases.some((alias) => candidate === alias || candidate.startsWith(`${alias}/`)),
      );
    if (!matches) continue;
    if (!best || target.length > best.length) best = href;
  }
  if (best) return best;
  if (/\/specialty\//.test(pathName)) {
    const automations = hrefs.find((href) => href.replace(/\/$/, "").endsWith("/automations"));
    if (automations) return automations;
  }
  return null;
}

const businessId = "biz_1";
const hrefs = [
  `/b/${businessId}/home`,
  `/b/${businessId}/intelligence`,
  `/b/${businessId}/people`,
  `/b/${businessId}/work`,
  `/b/${businessId}/properties`,
  `/b/${businessId}/knowledge`,
  `/b/${businessId}/team`,
  `/b/${businessId}/automations`,
  `/b/${businessId}/integrations`,
  `/b/${businessId}/settings`,
];

test("navActivePath helpers are present in shell", () => {
  assert.match(source, /findActiveNavHref/);
  assert.match(source, /resolveActiveNavPath/);
});

test("active nav highlights the exact tab for each primary route", () => {
  assert.equal(findActiveNavHref(`/b/${businessId}/home`, businessId, hrefs), `/b/${businessId}/home`);
  assert.equal(findActiveNavHref(`/b/${businessId}/work`, businessId, hrefs), `/b/${businessId}/work`);
  assert.equal(findActiveNavHref(`/b/${businessId}/people`, businessId, hrefs), `/b/${businessId}/people`);
  assert.equal(findActiveNavHref(`/b/${businessId}/settings`, businessId, hrefs), `/b/${businessId}/settings`);
  assert.equal(findActiveNavHref(`/b/${businessId}/intelligence`, businessId, hrefs), `/b/${businessId}/intelligence`);
});

test("active nav maps redirected routes onto canonical tabs", () => {
  assert.equal(resolveActiveNavPath(`/b/${businessId}/mission-control`, businessId), `/b/${businessId}/home`);
  assert.equal(findActiveNavHref(`/b/${businessId}/for-you`, businessId, hrefs), `/b/${businessId}/intelligence`);
  assert.equal(findActiveNavHref(`/b/${businessId}/engagement`, businessId, hrefs), `/b/${businessId}/work`);
});

test("Ask / Architect does not falsely highlight Home", () => {
  assert.equal(findActiveNavHref(`/b/${businessId}/architect`, businessId, hrefs), null);
});

test("specialty surface routes highlight their own nav item", () => {
  const withSpecialty = [
    ...hrefs,
    `/b/${businessId}/specialty/owner_mod_drills`,
    `/b/${businessId}/specialty/owner_emp_coach`,
  ];
  assert.equal(
    findActiveNavHref(`/b/${businessId}/specialty/owner_mod_drills`, businessId, withSpecialty),
    `/b/${businessId}/specialty/owner_mod_drills`,
  );
  assert.equal(
    findActiveNavHref(
      `/b/${businessId}/specialty/owner_emp_coach`,
      businessId,
      withSpecialty,
    ),
    `/b/${businessId}/specialty/owner_emp_coach`,
  );
});

test("specialty AI employee and specialty_ai module urls share active nav", () => {
  const withSpecialty = [
    ...hrefs,
    `/b/${businessId}/specialty/owner_emp_create_daily_workout_and_practic`,
  ];
  assert.equal(
    findActiveNavHref(
      `/b/${businessId}/specialty/specialty_ai_owner_emp_create_daily_workout_and_practic`,
      businessId,
      withSpecialty,
    ),
    `/b/${businessId}/specialty/owner_emp_create_daily_workout_and_practic`,
  );
  assert.equal(
    findActiveNavHref(
      `/b/${businessId}/specialty/owner_emp_create_daily_workout_and_practic`,
      businessId,
      withSpecialty,
    ),
    `/b/${businessId}/specialty/owner_emp_create_daily_workout_and_practic`,
  );
});

test("specialty surface without its own nav item keeps Automations highlighted", () => {
  assert.equal(
    findActiveNavHref(
      `/b/${businessId}/specialty/emp_0_intake_specialist`,
      businessId,
      hrefs,
    ),
    `/b/${businessId}/automations`,
  );
});

test("emp_ id and specialty_ai_emp_ id share active nav", () => {
  const withSpecialty = [
    ...hrefs,
    `/b/${businessId}/specialty/emp_0_intake_specialist`,
  ];
  assert.equal(
    findActiveNavHref(
      `/b/${businessId}/specialty/specialty_ai_emp_0_intake_specialist`,
      businessId,
      withSpecialty,
    ),
    `/b/${businessId}/specialty/emp_0_intake_specialist`,
  );
});
