import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { readinessLabelFor } from "./resolveResponsibilityFeasibility.js";

/**
 * Responsibility-scoped Go Live projection — partial open is honest.
 * Business can operate when ≥1 responsibility is safe; blocked ones stay visible.
 *
 * Home UI gets short owner verbs — never dump engine constraint essays.
 */

const SHORT_ACTION_BY_TYPE = Object.freeze({
  ACCOUNT_CONNECTION_REQUIRED: "Connect an account",
  AUTHORIZED_DATA_SOURCE_REQUIRED: "Connect a data source",
  BUSINESS_RULE_REQUIRED: "Confirm how this should work",
  CONSENT_POLICY_REQUIRED: "Confirm who we may contact",
  UNSUPPORTED_TRIGGER: "Change how this is triggered",
});

function shortActionForConstraint(constraint) {
  const type = String(constraint?.type ?? "");
  if (SHORT_ACTION_BY_TYPE[type]) return SHORT_ACTION_BY_TYPE[type];
  const resolution = String(constraint?.resolutionAction ?? "").toLowerCase();
  if (/email|gmail|outlook/.test(resolution)) return "Connect business email";
  if (/calendar/.test(resolution)) return "Connect calendar";
  if (/sms|twilio/.test(resolution)) return "Connect SMS";
  if (/phone|number|forward/.test(resolution)) return "Connect business phone";
  if (/clarif|question|rule/.test(resolution)) return "Answer a few questions";
  return "Finish this step";
}

function uniqueShortActions(constraints = []) {
  const seen = new Set();
  const out = [];
  for (const c of constraints) {
    if (String(c.status ?? "open") !== "open") continue;
    if (String(c.owner) !== "Customer") continue;
    const label = shortActionForConstraint(c);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= 2) break;
  }
  return out;
}

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
      const shortActions = uniqueShortActions(openCustomer);
      const primaryConstraint = openCustomer[0] ?? null;
      const primaryAction = shortActions[0]
        ?? (bucket === "needs_your_action" ? "Continue setup" : null);

      return deepFreeze({
        responsibilityId: request.responsibilityId,
        title: request.title,
        mode,
        readinessLabel: readinessLabelFor(mode),
        bucket,
        outcome: request.requestedOutcome || request.rawRequest,
        shortActions,
        primaryAction,
        primaryConstraintType: primaryConstraint?.type ?? null,
        constraints: constraints.map((c) => ({
          constraintId: c.constraintId,
          type: c.type,
          description: c.description,
          owner: c.owner,
          resolutionAction: c.resolutionAction,
          shortAction: shortActionForConstraint(c),
          status: c.status ?? "open",
          fallback: c.fallback ?? null,
        })),
        checklistHints: {
          businessEmailConnected: emailOk,
          calendarConnected: calendarOk,
        },
      });
    });

  // Collapse duplicate titles from messy Builder extracts (same outcome twice).
  const seenTitles = new Set();
  const deduped = [];
  for (const item of items) {
    const key = String(item.title ?? "").trim().toLowerCase();
    if (key && seenTitles.has(key)) continue;
    if (key) seenTitles.add(key);
    deduped.push(item);
  }
  const readyCount = deduped.filter((i) => ["ready_for_shadow", "live"].includes(i.bucket)).length;
  const actionable = deduped.filter((i) => i.bucket === "needs_your_action");
  const vibetechWorking = deduped.filter((i) => i.bucket === "vibetech_working");
  const blocked = deduped.filter((i) => i.bucket === "cannot_install");

  return deepFreeze({
    total: deduped.length,
    readyCount,
    canOpenBusiness: readyCount >= 1 || vibetechWorking.length >= 1,
    summary: deduped.length
      ? `${readyCount} of ${deduped.length} ready`
      : "No responsibilities yet",
    needsYourAction: actionable,
    vibetechWorking,
    readyForShadow: deduped.filter((i) => i.bucket === "ready_for_shadow"),
    live: deduped.filter((i) => i.bucket === "live"),
    cannotInstall: blocked,
    items: deduped,
  });
}
