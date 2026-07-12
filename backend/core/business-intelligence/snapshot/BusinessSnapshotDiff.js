import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function idsOf(items, idKey = "id") {
  return new Set((items ?? []).map((entry) => String(entry?.[idKey] ?? entry)));
}

function diffIds(before, after, label) {
  const beforeIds = idsOf(before);
  const afterIds = idsOf(after);
  const added = [...afterIds].filter((id) => !beforeIds.has(id));
  const removed = [...beforeIds].filter((id) => !afterIds.has(id));
  return deepFreeze({
    kind: label,
    added,
    removed,
    unchangedCount: [...afterIds].filter((id) => beforeIds.has(id)).length,
  });
}

/**
 * Smallest reusable foundation for “What changed?” comparisons.
 * Compares two evaluation/business snapshot points — backend-only for this milestone.
 */
export function compareBusinessSnapshots({
  before = {},
  after = {},
} = {}) {
  const changes = [];

  if (before.candidates || after.candidates) {
    const beforeOpen = (before.candidates ?? []).filter((c) => (
      ["DETECTED", "SURFACED", "IN_REVIEW"].includes(String(c.status))
    ));
    const afterOpen = (after.candidates ?? []).filter((c) => (
      ["DETECTED", "SURFACED", "IN_REVIEW"].includes(String(c.status))
    ));
    const opened = afterOpen.filter((c) => !beforeOpen.some((b) => b.id === c.id));
    const resolved = (after.candidates ?? []).filter((c) => (
      c.status === "RESOLVED" && (before.candidates ?? []).some((b) => b.id === c.id && b.status !== "RESOLVED")
    ));
    changes.push(deepFreeze({
      kind: "candidates",
      opened: opened.map((c) => c.id),
      resolved: resolved.map((c) => c.id),
    }));
  }

  if (before.work || after.work) {
    changes.push(diffIds(before.work, after.work, "work_records"));
    const overdueBefore = new Set((before.work ?? []).filter((w) => w.overdue).map((w) => w.id));
    const overdueAfter = (after.work ?? []).filter((w) => w.overdue).map((w) => w.id);
    changes.push(deepFreeze({
      kind: "work_overdue",
      added: overdueAfter.filter((id) => !overdueBefore.has(id)),
      cleared: [...overdueBefore].filter((id) => !overdueAfter.includes(id)),
    }));
    const completed = (after.work ?? []).filter((w) => (
      String(w.status) === "completed"
      && (before.work ?? []).some((b) => b.id === w.id && b.status !== "completed")
    ));
    changes.push(deepFreeze({
      kind: "work_completed",
      ids: completed.map((w) => w.id),
    }));
  }

  if (before.assignments || after.assignments) {
    changes.push(diffIds(before.assignments, after.assignments, "assignments"));
  }
  if (before.team || after.team) {
    changes.push(diffIds(before.team, after.team, "team"));
  }
  if (before.businessOs || after.businessOs) {
    const beforeVersion = before.businessOs?.version ?? before.businessOs?.specificationVersion;
    const afterVersion = after.businessOs?.version ?? after.businessOs?.specificationVersion;
    if (String(beforeVersion ?? "") !== String(afterVersion ?? "")) {
      changes.push(deepFreeze({
        kind: "business_os_configuration",
        beforeVersion: beforeVersion ?? null,
        afterVersion: afterVersion ?? null,
      }));
    }
  }
  if (before.integrations || after.integrations) {
    changes.push(diffIds(before.integrations, after.integrations, "integrations"));
  }

  return deepFreeze({
    generatedAt: new Date().toISOString(),
    changes,
    hasChanges: changes.some((entry) => {
      if (entry.added?.length || entry.removed?.length || entry.opened?.length || entry.resolved?.length) return true;
      if (entry.ids?.length || entry.cleared?.length) return true;
      if (entry.kind === "business_os_configuration") return true;
      return false;
    }),
  });
}

export function captureEvaluationPoint({
  intelligenceCandidateRuntime,
  workRuntime,
  teamRuntime,
  nowISO = new Date().toISOString(),
} = {}) {
  return deepFreeze({
    capturedAt: nowISO,
    candidates: (intelligenceCandidateRuntime?.getCandidates?.() ?? []).map((c) => ({
      id: c.id,
      status: c.status,
    })),
    work: (workRuntime?.getWorkItems?.() ?? []).map((w) => ({
      id: w.id,
      status: w.status,
      overdue: Boolean(w.dueAt && Date.parse(w.dueAt) < Date.parse(nowISO)
        && !["completed", "cancelled", "failed", "rejected"].includes(String(w.status))),
    })),
    team: (teamRuntime?.getMembers?.() ?? []).map((m) => ({ id: m.id })),
    assignments: (workRuntime?.getWorkItems?.() ?? [])
      .filter((w) => w.assignedTo || w.assigneeId)
      .map((w) => ({ id: `${w.id}:${w.assignedTo ?? w.assigneeId}` })),
  });
}
