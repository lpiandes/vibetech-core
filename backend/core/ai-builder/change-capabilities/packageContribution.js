import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getDefaultArchitectChangeCapabilityRegistry } from "./ArchitectChangeCapabilityRegistry.js";

/**
 * Package/blueprint contribution hook.
 * Industry packages register capabilities, synonyms, and availability without editing Architect core.
 */
export function contributeArchitectChangeCapabilities({
  source,
  capabilities = [],
  vocabulary = [],
  registry = getDefaultArchitectChangeCapabilityRegistry(),
} = {}) {
  if (!source) throw new Error("contributeArchitectChangeCapabilities: source required.");
  const registered = [];

  for (const definition of capabilities) {
    const withVocab = applyVocabulary(definition, vocabulary);
    registered.push(registry.register(withVocab, {
      replace: true,
      source: String(source),
    }));
  }

  // Vocabulary can enrich already-registered universal capabilities (synonyms/examples only).
  for (const entry of vocabulary) {
    const capabilityId = entry.capabilityId;
    if (!capabilityId) continue;
    const existing = registry.get(capabilityId);
    if (!existing) continue;
    const enriched = applyVocabulary({
      ...existing,
      // strip internal source marker before re-validate
      _source: undefined,
    }, [entry]);
    registered.push(registry.register(enriched, {
      replace: true,
      source: String(source),
    }));
  }

  return deepFreeze({
    ok: true,
    source: String(source),
    registeredCapabilityIds: [...new Set(registered.map((entry) => entry.capabilityId))],
  });
}

function applyVocabulary(definition, vocabulary) {
  if (!vocabulary?.length) return definition;
  const relevant = vocabulary.filter((entry) => (
    !entry.capabilityId || entry.capabilityId === definition.capabilityId
  ));
  if (!relevant.length) return definition;
  const extraKeywords = relevant.flatMap((entry) => entry.synonyms ?? entry.keywords ?? []);
  const extraExamples = relevant.flatMap((entry) => entry.examples ?? []);
  if (!extraKeywords.length && !extraExamples.length) return definition;
  const patterns = (definition.requestPatterns ?? []).map((pattern, index) => (
    index === 0
      ? {
        ...pattern,
        keywords: [...new Set([
          ...(pattern.keywords ?? []),
          ...extraKeywords.map((k) => String(k).toLowerCase()),
        ])],
        examples: [...new Set([...(pattern.examples ?? []), ...extraExamples.map(String)])],
      }
      : pattern
  ));
  const {
    _source,
    buildMutationPlan,
    collectMissingInformation,
    evaluateWarnings,
    ...rest
  } = definition;
  return {
    ...rest,
    requestPatterns: patterns,
    // Preserve optional hooks
    ...(buildMutationPlan ? { buildMutationPlan } : {}),
    ...(collectMissingInformation ? { collectMissingInformation } : {}),
    ...(evaluateWarnings ? { evaluateWarnings } : {}),
  };
}

/**
 * Prove packages can extend the registry without importing AiBuilderService.
 */
export function createPackageCapabilityContribution(packageId) {
  return {
    register(contribution) {
      return contributeArchitectChangeCapabilities({
        source: packageId,
        ...contribution,
      });
    },
  };
}
