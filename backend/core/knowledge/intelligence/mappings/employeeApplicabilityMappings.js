// Generic capability hints that help map document / business areas to likely employees.
// Employees are not hardcoded here; we only provide keyword hints used to match `employee.capabilities`.

const CAPABILITY_HINTS_BY_DOCUMENT_TYPE = {
  FAQ: ["faq", "support", "help", "customer service", "faq"],
  SOP: ["sop", "procedure", "operations", "workflow", "step-by-step"],
  PRICING: ["pricing", "price", "cost", "fee", "budget", "finance"],
  POLICIES: ["policy", "policies", "rules", "compliance", "legal", "regulation", "audit"],
  BRAND_VOICE: ["brand voice", "tone", "reading level", "style", "greeting", "closing"],
  MARKETING: ["marketing", "campaign", "newsletter", "promotion", "ad copy", "lead"],
  DOCUMENTS: ["document", "reference", "specification", "appendix", "regulation"],
  EMPLOYEE_HANDBOOK: ["handbook", "employee", "roles", "time off", "benefits", "vacation"],
  VENDOR_INFORMATION: ["vendor", "supplier", "contractor", "procurement", "w-9"],
  COMPLIANCE: ["compliance", "audit", "legal", "risk", "regulation", "mandatory"],
  "General Document": [],
};

const CAPABILITY_HINTS_BY_BUSINESS_AREA = {
  Sales: ["sales", "pricing", "quote", "deal", "proposal", "lead"],
  Operations: ["operations", "workflow", "procedure", "sop", "steps"],
  Legal: ["legal", "policy", "contract", "compliance", "regulation"],
  Finance: ["finance", "budget", "pricing", "cost", "fee", "pricing"],
  Maintenance: ["maintenance", "service", "repair", "fix"],
  Leasing: ["lease", "rent", "tenant", "tenancy", "move-in"],
  CustomerSupport: ["support", "help", "customer service", "ticket", "faq"],
  Marketing: ["marketing", "campaign", "newsletter", "promotion"],
  Administration: ["administration", "employee", "handbook", "roles", "time off", "benefits"],
};

export {
  CAPABILITY_HINTS_BY_BUSINESS_AREA,
  CAPABILITY_HINTS_BY_DOCUMENT_TYPE,
};

