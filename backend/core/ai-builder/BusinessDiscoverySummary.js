import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Human-readable discovery summary for the Builder UI.
 */
export function buildBusinessDiscoverySummary({ businessSummary = {}, completeness = {}, assumptions = [] } = {}) {
  const name = businessSummary.businessName ?? "Your business";
  const industry = (businessSummary.industry ?? "general").replace(/_/g, " ");
  const services = Array.isArray(businessSummary.services) ? businessSummary.services : [];
  const customers = Array.isArray(businessSummary.customerTypes) ? businessSummary.customerTypes : [];

  return deepFreeze({
    title: name,
    headline: `${name} looks like a ${industry} business.`,
    bullets: [
      services.length ? `Services: ${services.join(", ")}` : "Services still being confirmed",
      customers.length ? `Customers: ${customers.join(", ")}` : "Customer types still being confirmed",
      completeness.readyForProposal
        ? "Enough is known for a first operating system proposal"
        : `${completeness.requiredMissing?.length ?? 0} important question(s) remain`,
    ],
    assumptions: assumptions.map((entry) => entry.text ?? entry),
    confidenceNote: completeness.unknownQuestionIds?.length
      ? "Some answers were marked unknown and stay unresolved."
      : "Known facts are evidence-backed or confirmed by you.",
  });
}
