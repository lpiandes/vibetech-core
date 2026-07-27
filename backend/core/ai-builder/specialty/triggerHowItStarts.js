/**
 * Owner-facing copy for how an automation starts.
 * Prefer this over vague trigger.summary strings in the UI.
 */
import { specialtyEventLabel } from "./specialtyEventCatalog.js";

const MANUAL_EVENTS = new Set(["SPECIALTY_JOB_REQUESTED"]);

function eventIds(trigger) {
  return Array.isArray(trigger?.eventTypes)
    ? trigger.eventTypes.map(String).filter(Boolean)
    : [];
}

function automaticEventLabels(trigger) {
  return eventIds(trigger)
    .filter((id) => !MANUAL_EVENTS.has(id))
    .map((id) => specialtyEventLabel(id));
}

/**
 * Short header line under the automation title.
 */
export function describeHowAutomationStarts({ trigger = null, live = false } = {}) {
  const auto = automaticEventLabels(trigger);
  const mode = String(trigger?.mode ?? "manual_or_events");

  const manual = "Manual: click Run now on this page.";

  if (mode === "manual") {
    return `${manual} Automatic: off for this path.`;
  }

  if (!live) {
    if (auto.length) {
      return `${manual} Automatic (when LIVE): ${auto.join(" · ")}.`;
    }
    return `${manual} Automatic: turn LIVE on to allow schedule/events.`;
  }

  if (auto.length) {
    return `${manual} LIVE now listens for: ${auto.join(" · ")}.`;
  }
  return `${manual} LIVE is on — add Calendar/pipeline events or a weekly schedule to start automatically.`;
}

/**
 * START node title + subtitle for the path canvas.
 */
export function presentTriggerStartCopy({ trigger = null } = {}) {
  const auto = automaticEventLabels(trigger);
  const mode = String(trigger?.mode ?? "manual_or_events");

  if (mode === "manual") {
    return {
      title: "Starts when you click Run now",
      summary: "Click Run now on this page. Nothing runs by itself.",
    };
  }
  if (mode === "schedule") {
    return {
      title: "Starts on a schedule",
      summary: auto.length
        ? `Also listens for: ${auto.join(" · ")}. Manual: Run now.`
        : "Weekly/digest schedule when LIVE. Manual: Run now.",
    };
  }
  if (mode === "events") {
    return {
      title: "Starts when events happen",
      summary: auto.length
        ? `LIVE listens for: ${auto.join(" · ")}. Manual: Run now.`
        : "LIVE listens for platform events. Manual: Run now.",
    };
  }
  return {
    title: "Starts manually or from events",
    summary: auto.length
      ? `Manual: Run now. LIVE automatic: ${auto.join(" · ")}.`
      : "Manual: Run now. LIVE automatic: Calendar / schedule / configured events.",
  };
}
