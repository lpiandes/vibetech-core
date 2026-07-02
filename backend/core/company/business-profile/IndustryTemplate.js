function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

export function createIndustryTemplate(input = {}) {
  const {
    id,
    name,
    description,
    recommendedCapabilities = [],
    recommendedDigitalEmployees = [],
    recommendedKnowledgeCategories = [],
    recommendedDashboardModules = [],
    recommendedKPIs = [],
    recommendedIntegrations = [],
    futureOnboardingQuestions = [],
    // Optional: operational defaults used to build the BusinessProfile model.
    businessSegments,
    servicesOffered,
    customerTypes,
    serviceAreas,
    operatingModel,
    companySize,
    languagesSupported,
    emergencyServices,
    appointmentBased,
    remoteOrOnsite,
    businessGoals,
  } = input ?? {};

  if (typeof id !== "string" || !id.trim()) throw new Error("IndustryTemplate: id required.");
  if (typeof name !== "string" || !name.trim()) throw new Error("IndustryTemplate: name required.");
  if (typeof description !== "string") throw new Error("IndustryTemplate: description required.");

  const tpl = {
    id: String(id),
    name: String(name),
    description: String(description),
    recommendedCapabilities: Array.isArray(recommendedCapabilities)
      ? recommendedCapabilities.map(String)
      : [],
    recommendedDigitalEmployees: Array.isArray(recommendedDigitalEmployees)
      ? recommendedDigitalEmployees.map(String)
      : [],
    recommendedKnowledgeCategories: Array.isArray(recommendedKnowledgeCategories)
      ? recommendedKnowledgeCategories.map(String)
      : [],
    recommendedDashboardModules: Array.isArray(recommendedDashboardModules)
      ? recommendedDashboardModules.map(String)
      : [],
    recommendedKPIs: Array.isArray(recommendedKPIs) ? recommendedKPIs.map(String) : [],
    recommendedIntegrations: Array.isArray(recommendedIntegrations)
      ? recommendedIntegrations.map(String)
      : [],
    futureOnboardingQuestions: Array.isArray(futureOnboardingQuestions)
      ? futureOnboardingQuestions.map(String)
      : [],

    // Operational defaults (optional)
    businessSegments: Array.isArray(businessSegments) ? businessSegments.map(String) : [],
    servicesOffered: Array.isArray(servicesOffered) ? servicesOffered.map(String) : [],
    customerTypes: Array.isArray(customerTypes) ? customerTypes.map(String) : [],
    serviceAreas: Array.isArray(serviceAreas) ? serviceAreas.map(String) : [],
    operatingModel: operatingModel ? String(operatingModel) : "",
    companySize: companySize ? String(companySize) : "",
    languagesSupported: Array.isArray(languagesSupported) ? languagesSupported.map(String) : [],
    emergencyServices: typeof emergencyServices === "boolean" ? emergencyServices : false,
    appointmentBased: typeof appointmentBased === "boolean" ? appointmentBased : true,
    remoteOrOnsite: remoteOrOnsite ? String(remoteOrOnsite) : "HYBRID",
    businessGoals: Array.isArray(businessGoals) ? businessGoals.map(String) : [],
  };

  return deepFreeze(tpl);
}

