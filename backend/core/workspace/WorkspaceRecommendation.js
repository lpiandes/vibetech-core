import { deepFreeze } from "./_utils/deepFreeze.js";

export function buildWorkspaceRecommendations({ capabilities } = {}) {
  const caps = Array.isArray(capabilities) ? capabilities : [];
  const byId = new Map(caps.map((c) => [c.id, c]));

  const recs = [];
  const getStatus = (id) => byId.get(id)?.status ?? "NOT_STARTED";

  if (getStatus("company_identity") !== "READY") recs.push("Complete Company Profile");
  if (getStatus("business_profile") !== "READY") recs.push("Complete Business Setup");
  if (getStatus("knowledge") !== "READY") recs.push("Publish Knowledge");
  if (getStatus("communications") !== "READY") recs.push("Configure Communications");
  if (getStatus("digital_workforce") !== "READY") recs.push("Review Employee Suggestions");
  if (getStatus("integrations") !== "READY") recs.push("Connect a CRM");

  // Deterministic de-dup
  const seen = new Set();
  const unique = [];
  for (const r of recs) {
    if (seen.has(r)) continue;
    seen.add(r);
    unique.push(r);
  }

  return deepFreeze({
    items: unique,
  });
}

