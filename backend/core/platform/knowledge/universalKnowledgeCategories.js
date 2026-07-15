/**
 * Universal Knowledge categories owners understand.
 * Industry packages may overlay additional PM_* / specialty ids.
 */
export const UNIVERSAL_KNOWLEDGE_CATEGORIES = Object.freeze([
  Object.freeze({ id: "CONTRACTS", label: "Contracts", description: "Agreements, leases, and signed commitments" }),
  Object.freeze({ id: "POLICIES", label: "Policies", description: "Governance and response rules" }),
  Object.freeze({ id: "SOP", label: "SOPs", description: "Standard operating procedures" }),
  Object.freeze({ id: "PRICING", label: "Pricing", description: "Rates, fees, and packages" }),
  Object.freeze({ id: "BRAND_VOICE", label: "Brand voice", description: "Tone and writing guidance" }),
  Object.freeze({ id: "FAQ", label: "FAQ", description: "Approved answers to common questions" }),
  Object.freeze({ id: "CURRICULUM", label: "Curriculum", description: "Training plans, drills, and governing-body materials" }),
  Object.freeze({ id: "LEGAL", label: "Legal", description: "Regulatory and legal reference" }),
  Object.freeze({ id: "PLAYBOOKS", label: "Playbooks", description: "How we run recurring work" }),
  Object.freeze({ id: "EMPLOYEE_HANDBOOK", label: "Employee handbook", description: "Internal people guidance" }),
]);

export function normalizeKnowledgeCategoryIds(input) {
  const allowed = new Set(UNIVERSAL_KNOWLEDGE_CATEGORIES.map((entry) => entry.id));
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[,\s]+/)
      : [];
  const ids = [];
  for (const entry of raw) {
    const id = String(entry ?? "").trim().toUpperCase();
    if (!id || !allowed.has(id) || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}
