import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBusinessOSSpecification } from "../business-os/BusinessOSSpecification.js";
import { diffBusinessOSSpecifications } from "../business-os/BusinessOSSpecificationDiff.js";

/**
 * Reconcile a proposed next specification against the installed version.
 */
export class BuilderSpecificationReconciler {
  reconcile({ installedSpecification = null, proposedSpecification } = {}) {
    if (!proposedSpecification) throw new Error("BuilderSpecificationReconciler: proposedSpecification required.");
    if (!installedSpecification) {
      return deepFreeze({
        kind: "initial",
        changed: true,
        diff: diffBusinessOSSpecifications({ previous: null, next: proposedSpecification }),
        nextVersion: proposedSpecification.version ?? 1,
      });
    }

    const nextVersion = Number(installedSpecification.version ?? installedSpecification.specificationVersion ?? 1) + 1;
    const next = createBusinessOSSpecification({
      ...proposedSpecification,
      specificationId: installedSpecification.specificationId,
      specificationVersion: nextVersion,
      version: nextVersion,
      businessId: installedSpecification.businessId,
      status: "proposed",
    });
    const diff = diffBusinessOSSpecifications({ previous: installedSpecification, next });
    return deepFreeze({
      kind: "upgrade",
      changed: diff.changed,
      diff,
      nextVersion,
      nextSpecification: next,
    });
  }
}
