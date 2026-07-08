import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function computeAutomationMetrics({ automations, runs } = {}) {
  const autos = Array.isArray(automations) ? automations : [];
  const rs = Array.isArray(runs) ? runs : [];

  const totalAutomations = autos.length;
  const activeAutomations = autos.filter((a) => String(a.status) === "ACTIVE").length;

  const totalRuns = rs.length;
  const completedRuns = rs.filter((r) => String(r.status) === "COMPLETED").length;
  const failedRuns = rs.filter((r) => String(r.status) === "FAILED").length;

  const runsByAutomation = {};
  for (const r of rs) {
    const aid = String(r.automationId);
    const bucket = runsByAutomation[aid] ?? { totalRuns: 0, completedRuns: 0, failedRuns: 0 };
    bucket.totalRuns += 1;
    if (String(r.status) === "COMPLETED") bucket.completedRuns += 1;
    if (String(r.status) === "FAILED") bucket.failedRuns += 1;
    runsByAutomation[aid] = bucket;
  }

  return deepFreeze({
    totalAutomations,
    activeAutomations,
    totalRuns,
    completedRuns,
    failedRuns,
    runsByAutomation: deepFreeze(runsByAutomation),
  });
}
