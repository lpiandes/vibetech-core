import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBusinessOSSpecification } from "../business-os/BusinessOSSpecification.js";

/**
 * Applies a confirmed change proposal onto a specification (immutable).
 */
export class BuilderSpecificationChangePlanner {
  apply({ specification, change } = {}) {
    if (!specification) throw new Error("BuilderSpecificationChangePlanner: specification required.");
    if (!change) throw new Error("BuilderSpecificationChangePlanner: change required.");

    const nextVersion = Number(specification.version ?? specification.specificationVersion ?? 1) + 1;
    let patch = {};

    switch (change.kind) {
      case "terminology_rename":
        patch = {
          terminology: {
            ...specification.terminology,
            presentation: {
              ...(specification.terminology?.presentation ?? {}),
              [change.from]: change.to,
            },
          },
          modules: specification.modules.map((module) => (
            module.label === change.from ? { ...module, label: change.to } : module
          )),
        };
        break;
      case "add_module": {
        const moduleId = String(change.moduleId ?? change.label ?? "new_module")
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 40) || "new_module";
        patch = {
          modules: [
            ...specification.modules,
            {
              moduleId,
              label: change.label ?? "New workspace",
              moduleType: change.moduleType ?? "operations",
              primaryNavigationEligible: true,
              navigationPriority: 40,
              capabilityIds: [],
            },
          ],
        };
        break;
      }
      case "remove_employee":
        patch = {
          employeeDefinitions: specification.employeeDefinitions.filter((employee) => (
            !String(employee.label).toLowerCase().includes(String(change.match ?? change.text ?? "").toLowerCase().replace(/.*remove\s+/i, "").replace(/\s+employee.*/i, "").trim())
            && employee.employeeId !== change.employeeId
          )),
        };
        break;
      case "permission_change":
        patch = {
          roleDefinitions: (specification.roleDefinitions ?? []).map((role) => {
            if (String(change.text).toLowerCase().includes("managers") && String(change.text).toLowerCase().includes("billing")) {
              if (role.roleId === "manager" || role.membershipRole === "MANAGER") {
                return {
                  ...role,
                  moduleVisibility: [...new Set([...(role.moduleVisibility ?? []), "billing"])],
                };
              }
              if (role.roleId === "employee" || role.membershipRole === "EMPLOYEE") {
                return {
                  ...role,
                  deniedModules: [...new Set([...(role.deniedModules ?? []), "billing"])],
                };
              }
            }
            return role;
          }),
        };
        break;
      case "add_campaign":
        patch = {
          campaignDefinitions: [
            ...specification.campaignDefinitions,
            {
              campaignTemplateId: `campaign_${nextVersion}`,
              label: change.label ?? "New campaign",
              channel: "email",
              approvalRequired: true,
            },
          ],
        };
        break;
      case "add_approval":
        patch = {
          governancePolicies: [
            ...specification.governancePolicies,
            {
              policyId: `approval_${nextVersion}`,
              label: change.label ?? "Additional approval required",
              enforced: true,
            },
          ],
        };
        break;
      case "add_workflow":
        patch = {
          workflowDefinitions: [
            ...specification.workflowDefinitions,
            {
              workflowId: `workflow_${nextVersion}`,
              label: change.label ?? "New workflow",
            },
          ],
        };
        break;
      default:
        patch = {
          unresolvedRequirements: [
            ...specification.unresolvedRequirements,
            { id: `change_${nextVersion}`, question: change.text ?? "Unrecognized change — needs clarification." },
          ],
        };
    }

    const next = createBusinessOSSpecification({
      ...specification,
      ...patch,
      specificationVersion: nextVersion,
      version: nextVersion,
      status: "proposed",
      updatedAt: new Date().toISOString(),
      contentHash: null,
    });

    return deepFreeze({
      ok: true,
      previousHash: specification.contentHash,
      nextSpecification: next,
      requiresDryRun: true,
      requiresApproval: true,
    });
  }
}
