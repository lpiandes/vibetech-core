import { createConnectedSystem } from "./ConnectedSystem.js";
import { createConnectedSystemDefaults } from "./ConnectedSystemDefaults.js";
import { ConnectedSystemRegistry } from "./ConnectedSystemRegistry.js";

function healthFromStatus(status, configured) {
  if (status === "READY") return "HEALTHY";
  if (status === "DEGRADED") return "DEGRADED";
  if (status === "BLOCKED") return "DEGRADED";
  if (status === "IN_PROGRESS") return "DEGRADED";
  if (status === "DISABLED") return configured ? "DEGRADED" : "UNAVAILABLE";
  return "DEGRADED";
}

function determineStatus({ configured, authenticated, baseReady } = {}) {
  if (!configured) return "DISABLED";
  if (baseReady) return "READY";
  if (configured && authenticated) return "IN_PROGRESS";
  return "NOT_STARTED";
}

export class ConnectedSystemBuilder {
  static buildSnapshot({ runtime, integrations, knowledgeRepository, knowledgeCategories } = {}) {
    const hasRuntime = Boolean(runtime);
    if (!hasRuntime && !Array.isArray(integrations) && !knowledgeRepository && !knowledgeCategories) {
      throw new Error("ConnectedSystemBuilder.buildSnapshot requires runtime or integrations/knowledge inputs.");
    }

    const registry = new ConnectedSystemRegistry();
    const nowISO = "2026-07-01T00:00:00.000Z";

    const integrationList = Array.isArray(integrations)
      ? integrations
      : hasRuntime && Array.isArray(runtime.getIntegrations?.())
        ? runtime.getIntegrations()
        : [];
    const connected = [];

    for (const integration of integrationList) {
      const type = String(integration?.type ?? "");
      const id = `cs_${type}`;
      const configured = true;
      const authenticated = Boolean(integration?.connected === true);

      let category = "Custom";
      let provider = type;
      let baseReady = Boolean(integration?.connected === true);
      if (type === "email") {
        category = "Communication";
        provider = "email";
      } else if (type === "website") {
        category = "Website";
        provider = "website_intake";
      } else if (type === "crm") {
        category = "CRM";
        provider = "crm";
      } else {
        category = "Custom";
        provider = type || "custom";
      }

      const spec = registry.getSpec({ category, provider }) ?? registry.getDefaultSpec({ category });

      const status = determineStatus({ configured, authenticated, baseReady });
      const health = healthFromStatus(status, configured);

      connected.push(
        createConnectedSystem({
          ...createConnectedSystemDefaults(),
          id,
          name: spec.category === "Custom" ? `Custom ${type}` : `${spec.category} (${type})`,
          category: spec.category,
          provider,
          status,
          health,
          configured,
          authenticated,
          lastValidated: nowISO,
          features: spec.features,
          capabilitiesUnlocked: spec.capabilitiesUnlocked,
          metadata: integration?.vendor ? { vendor: integration.vendor } : {},
        }),
      );
    }

    // Knowledge Source connected system derived from knowledge repository state.
    const knowledgeRepo = knowledgeRepository ?? (hasRuntime ? runtime.getKnowledgeRepository?.() : null);
    const repoItems = Array.isArray(knowledgeRepo?.items) ? knowledgeRepo.items : [];
    const publishedCount = repoItems.filter((i) => i && i.status !== "ARCHIVED").length;
    const knowledgeCategoriesObj = knowledgeCategories ?? (hasRuntime ? runtime.getKnowledgeCategories?.() : null);
    const categoriesCount = Array.isArray(knowledgeCategoriesObj?.items)
      ? knowledgeCategoriesObj.items.length
      : 0;
    const baseReady = publishedCount > 0 && categoriesCount > 0;

    const knowledgeSpec =
      registry.getSpec({ category: "Knowledge Source", provider: "knowledge_os" }) ??
      registry.getDefaultSpec({ category: "Knowledge Source" });

    const knowledgeStatus = determineStatus({
      configured: true,
      authenticated: true,
      baseReady,
    });
    const knowledgeHealth = healthFromStatus(knowledgeStatus, true);

    connected.push(
      createConnectedSystem({
        ...createConnectedSystemDefaults(),
        id: "cs_knowledge_os",
        name: "Knowledge OS",
        category: "Knowledge Source",
        provider: "knowledge_os",
        status: knowledgeStatus,
        health: knowledgeHealth,
        configured: true,
        authenticated: true,
        lastValidated: nowISO,
        features: knowledgeSpec.features,
        capabilitiesUnlocked: knowledgeSpec.capabilitiesUnlocked,
        metadata: { publishedCount, categoriesCount },
      }),
    );

    return Object.freeze(connected.map((c) => c));
  }
}

