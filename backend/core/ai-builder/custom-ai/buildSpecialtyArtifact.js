/**
 * Re-export specialty composer under the legacy path so older imports keep working.
 */
export {
  composeSpecialtyArtifact as buildSpecialtyArtifact,
  composeSpecialtyArtifact,
  hydrateSpecialtyArtifact,
  resolveSpecialtyArtifactTemplate,
  resolveVocabularyPack,
} from "../specialty/SpecialtyArtifactComposer.js";

export {
  consultSpecialtySources,
  extractActivitiesFromSources,
} from "../specialty/consultSpecialtySources.js";

export {
  resolveMatchingAuthorityPacks,
  SPECIALTY_AUTHORITY_PACKS,
} from "../specialty/SpecialtyAuthorityRegistry.js";
