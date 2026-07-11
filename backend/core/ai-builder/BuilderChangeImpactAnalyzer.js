import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { diffBusinessOSSpecifications } from "../business-os/BusinessOSSpecificationDiff.js";

export class BuilderChangeImpactAnalyzer {
  analyze({ previousSpecification, nextSpecification, change } = {}) {
    const diff = diffBusinessOSSpecifications({
      previous: previousSpecification,
      next: nextSpecification,
    });
    return deepFreeze({
      requestedChange: change?.text ?? change?.kind ?? "change",
      kind: change?.kind ?? "generic_change",
      affectedAreas: [
        ...(diff.addedModules.length ? ["modules"] : []),
        ...(diff.changedModules.length ? ["modules"] : []),
        ...(diff.addedCapabilities.length ? ["capabilities"] : []),
        ...(change?.kind === "permission_change" ? ["roles", "permissions"] : []),
        ...(change?.kind === "terminology_rename" ? ["terminology", "navigation"] : []),
        ...(change?.kind === "add_campaign" ? ["campaigns"] : []),
        ...(change?.kind === "add_workflow" ? ["workflows"] : []),
      ],
      explanation: "This change updates your Business OS proposal. It will not install until you dry-run and approve.",
      risk: change?.kind === "permission_change" ? "medium" : "low",
      specificationDiff: diff,
      requiresDryRun: true,
      requiresApproval: true,
    });
  }
}
