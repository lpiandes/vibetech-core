/**
 * Backward-compatible re-export. Prefer InstallationPlan.js for new code.
 */
export {
  BUSINESS_OS_INSTALL_ACTION_TYPES,
  stableInstallActionId,
  createInstallAction,
  createBusinessOSInstallationPlan,
  createInstallationPlan,
  createInstallationOperation,
} from "./InstallationPlan.js";
