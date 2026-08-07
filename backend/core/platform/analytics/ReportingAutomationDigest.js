/**
 * Reporting and Dashboard Automation — scheduled owner digest configuration
 * on installation.configuration.reportingDigest, plus an honest
 * "present now" composer built from SalesAnalyticsDashboard + Outcomes.
 *
 * This module does not fabricate a send history — scheduleDigest only
 * persists the schedule preference; actually dispatching a digest email is a
 * separate delivery concern (reuses the same Gmail/notification paths as the
 * rest of the platform) and is out of scope here to avoid inventing a second
 * outbound pipe.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { composeSalesAnalyticsDashboard } from "./SalesAnalyticsDashboard.js";

export const DIGEST_FREQUENCIES = Object.freeze(["daily", "weekly"]);

function nowISO() {
  return new Date().toISOString();
}

export function emptyDigestSchedule() {
  return {
    version: 1,
    enabled: false,
    frequency: "weekly",
    hourUtc: 13,
    lastPresentedAt: null,
    updatedAt: null,
  };
}

export function readDigestSchedule(installation = null) {
  const raw = installation?.configuration?.reportingDigest;
  if (!raw || typeof raw !== "object") return emptyDigestSchedule();
  return {
    version: 1,
    enabled: Boolean(raw.enabled),
    frequency: DIGEST_FREQUENCIES.includes(String(raw.frequency)) ? String(raw.frequency) : "weekly",
    hourUtc: Number.isFinite(Number(raw.hourUtc)) ? Number(raw.hourUtc) : 13,
    lastPresentedAt: raw.lastPresentedAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

async function writeDigestSchedule({ platformStore, installation, schedule, actorId = null }) {
  if (!platformStore || !installation) {
    throw new Error("writeDigestSchedule requires platformStore and installation");
  }
  const next = { ...schedule, version: 1, updatedAt: nowISO() };
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId ?? `spec_${installation.businessId}`,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "reporting_digest_update",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
    configuration: {
      ...(installation.configuration ?? {}),
      reportingDigest: next,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history.slice(-49) : []),
      { at: next.updatedAt, action: "reporting_digest_update", actorId },
    ],
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? null,
  });
  return next;
}

/**
 * Persist the owner's digest schedule preference.
 * @returns {Promise<object>} the saved schedule
 */
export async function scheduleDigest({
  platformStore,
  installation,
  enabled,
  frequency,
  hourUtc,
  actorId = null,
}) {
  const current = readDigestSchedule(installation);
  const next = {
    ...current,
    enabled: enabled === undefined ? current.enabled : Boolean(enabled),
    frequency: frequency && DIGEST_FREQUENCIES.includes(String(frequency)) ? String(frequency) : current.frequency,
    hourUtc: Number.isFinite(Number(hourUtc)) ? Math.max(0, Math.min(23, Number(hourUtc))) : current.hourUtc,
  };
  const persisted = await writeDigestSchedule({ platformStore, installation, schedule: next, actorId });
  return deepFreeze(persisted);
}

/**
 * Compose a digest immediately from live pipeline + outcomes state and
 * stamp lastPresentedAt on the schedule. Does not send anything — "present"
 * only, per the honest scope of this module.
 * @returns {Promise<{ schedule: object, digest: object }>}
 */
export async function presentDigestNow({
  platformStore,
  installation,
  businessId = installation?.businessId,
  recentOutcomes = [],
  workItems = null,
  assignments = [],
  actorId = null,
}) {
  const dashboard = composeSalesAnalyticsDashboard({
    installation,
    businessId,
    recentOutcomes,
    workItems,
    assignments,
  });

  const digest = deepFreeze({
    generatedAt: dashboard.generatedAt,
    businessId,
    headline: `${dashboard.pipeline.openCards} open opportunit${dashboard.pipeline.openCards === 1 ? "y" : "ies"}, ${dashboard.outcomes.proofBackedCompleted} proof-backed completion${dashboard.outcomes.proofBackedCompleted === 1 ? "" : "s"}`,
    sections: [
      {
        id: "pipeline",
        label: "Pipeline",
        stats: [
          { label: "Total contacts", value: dashboard.pipeline.totalContacts },
          { label: "Open opportunities", value: dashboard.pipeline.openCards },
          { label: "Won", value: dashboard.pipeline.wonCards },
          { label: "Lost", value: dashboard.pipeline.lostCards },
        ],
      },
      {
        id: "outcomes",
        label: "Outcomes",
        stats: [
          { label: "Proof-backed completions", value: dashboard.outcomes.proofBackedCompleted },
          { label: "Unproven", value: dashboard.outcomes.unproven },
          { label: "Exceptions", value: dashboard.outcomes.exceptions },
        ],
      },
      {
        id: "work",
        label: "Work",
        stats: dashboard.work.status === "observable"
          ? [
            { label: "Open work", value: dashboard.work.openWork },
            { label: "Overdue", value: dashboard.work.overdueWork },
          ]
          : [{ label: "Open work", value: "not_observable" }],
      },
    ],
    honesty: dashboard.honesty,
  });

  let schedule = readDigestSchedule(installation);
  if (platformStore && installation) {
    schedule = await writeDigestSchedule({
      platformStore,
      installation,
      schedule: { ...schedule, lastPresentedAt: digest.generatedAt },
      actorId,
    });
  }

  return deepFreeze({ schedule, digest });
}
