import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { readinessLabelFor } from "./resolveResponsibilityFeasibility.js";

/**
 * Responsibility-scoped Go Live projection — partial open is honest.
 * Business can operate when ≥1 responsibility is safe; blocked ones stay visible.
 */

export function presentResponsibilityGoLive({
  responsibilityRequests = [],
  connectionStatuses = {},
} = {}) {
  const items = (Array.isArray(responsibilityRequests) ? responsibilityRequests : [])
    .filter((r) => r && String(r.status) !== "removed")
    .map((request) => {
      const constraints = Array.isArray(request.constraints) ? request.constraints : [];
      const openCustomer = constraints.filter(
        (c) => String(c.status ?? "open") === "open" && String(c.owner) === "Customer",
      );
      const openVibetech = constraints.filter(
        (c) => String(c.status ?? "open") === "open" && String(c.owner) === "VIBETech",
      );
      const mode = String(request.implementationMode ?? "");
      let bucket = "needs_clarification";
      if (mode === "unsupported_or_unsafe") bucket = "cannot_install";
      else if (openCustomer.length) bucket = "needs_your_action";
      else if (openVibetech.length || mode === "operator_assisted" || mode === "requires_reusable_capability") {
        bucket = "vibetech_working";
      } else if (mode === "ready_existing_capabilities") {
        bucket = "ready_for_shadow";
      } else if (String(request.status) === "live") {
        bucket = "live";
      }

      const emailOk = String(connectionStatuses.business_email ?? "").toUpperCase() === "CONNECTED";
      const calendarOk = String(connectionStatuses.calendar ?? "").toUpperCase() === "CONNECTED";

      return deepFreeze({
        responsibilityId: request.responsibilityId,
        title: request.title,
        mode,
        readinessLabel: readinessLabelFor(mode),
        bucket,
        outcome: request.requestedOutcome || request.rawRequest,
        constraints: constraints.map((c) => ({
          constraintId: c.constraintId,
          type: c.type,
          description: c.description,
          owner: c.owner,
          resolutionAction: c.resolutionAction,
          status: c.status ?? "open",
          fallback: c.fallback ?? null,
        })),
        checklistHints: {
          businessEmailConnected: emailOk,
          calendarConnected: calendarOk,
        },
      });
    });

  const readyCount = items.filter((i) => ["ready_for_shadow", "live"].includes(i.bucket)).length;
  const actionable = items.filter((i) => i.bucket === "needs_your_action");
  const vibetechWorking = items.filter((i) => i.bucket === "vibetech_working");
  const blocked = items.filter((i) => i.bucket === "cannot_install");

  return deepFreeze({
    total: items.length,
    readyCount,
    canOpenBusiness: readyCount >= 1 || vibetechWorking.length >= 1,
    summary: items.length
      ? `${readyCount} of ${items.length} responsibilities ready`
      : "No responsibilities confirmed yet",
    needsYourAction: actionable,
    vibetechWorking,
    readyForShadow: items.filter((i) => i.bucket === "ready_for_shadow"),
    live: items.filter((i) => i.bucket === "live"),
    cannotInstall: blocked,
    items,
  });
}
