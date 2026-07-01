import { BrainSearch } from "./BrainSearch.js";
import { createBusinessContext } from "./BusinessContext.js";

/**
 * CompanyBrain (v1)
 *
 * Exposes one public method:
 * buildBusinessContext(request)
 */
export class CompanyBrain {
  /**
   * @param {object} params
   * @param {CompanyWorkspaceRuntime} params.runtime
   */
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("CompanyBrain requires `runtime`.");
    this.runtime = runtime;
    this.brainSearch = new BrainSearch({ runtime });
  }

  buildBusinessContext(request = {}) {
    const { employeeId, task, companyId, relatedEntities } = request;

    const searchResult = this.brainSearch.search({
      task: safeString(task) || "unknown_task",
      relatedEntities: relatedEntities ?? {},
    });

    const businessContext = createBusinessContext({
      structuredData: searchResult.structuredData,
      relevantDocuments: searchResult.relevantDocuments,
      relevantPolicies: searchResult.relevantPolicies,
      brandVoice: searchResult.brandVoice,
      operationalRules: searchResult.operationalRules,
      historicalMemory: searchResult.historicalMemory,
      summary: searchResult.summary,
      confidence: searchResult.confidence,
      // Optional metadata for future use/debugging.
      employeeId,
      companyId,
    });

    return businessContext;
  }
}

function safeString(v) {
  return v === undefined || v === null ? "" : String(v);
}

