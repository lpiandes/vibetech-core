import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { createWorkStage } from "./WorkStage.js";
import { createWorkQueue } from "./WorkQueue.js";
import { createWorkItem } from "./WorkItem.js";
import { computeWorkMetrics } from "./WorkMetrics.js";

import { WORK_ASSIGNMENT_STATUSES } from "./WorkAssignmentTypes.js";

const DEFAULT_STAGE_STATUS = "active";

function buildDefaultStages() {
  const stages = [
    { id: "stage_intake", name: "Intake", description: "Receive and structure new work.", sortOrder: 1 },
    { id: "stage_review", name: "Review", description: "Assess work requirements and readiness.", sortOrder: 2 },
    { id: "stage_approval", name: "Approval", description: "Seek approvals and authorization.", sortOrder: 3 },
    { id: "stage_execution", name: "Execution", description: "Perform the work and produce outputs.", sortOrder: 4 },
    { id: "stage_follow_up", name: "Follow Up", description: "Handle follow-up tasks and continuity.", sortOrder: 5 },
    { id: "stage_complete", name: "Complete", description: "Finalize and close the work.", sortOrder: 6 },
  ];

  return stages.map((s) =>
    createWorkStage({
      ...s,
      status: DEFAULT_STAGE_STATUS,
      requirements: [],
      exitCriteria: [],
      metadata: deepFreeze({ seeded: true }),
    }),
  );
}

function buildDefaultQueues() {
  const queues = [
    { id: "queue_needs_review", name: "Needs Review", description: "Work that requires review.", type: "review", priority: "high" },
    { id: "queue_blocked", name: "Blocked", description: "Work blocked by dependencies or issues.", type: "blocked", priority: "critical" },
    { id: "queue_in_progress", name: "In Progress", description: "Work currently being executed.", type: "execution", priority: "medium" },
    { id: "queue_follow_up", name: "Follow Up", description: "Work awaiting follow-up completion steps.", type: "follow_up", priority: "low" },
    { id: "queue_approvals", name: "Approvals", description: "Work waiting on approval decisions.", type: "approvals", priority: "high" },
    { id: "queue_exceptions", name: "Exceptions", description: "Work requiring exception handling.", type: "exceptions", priority: "medium" },
    { id: "queue_completed", name: "Completed", description: "Work completed and closed.", type: "completed", priority: "low" },
  ];

  return queues.map((q) =>
    createWorkQueue({
      ...q,
      workItemIds: [],
      owner: "system",
      metadata: deepFreeze({ seeded: true }),
    }),
  );
}

export function buildDefaultWorkSeed({ nowISO } = {}) {
  const stages = buildDefaultStages();
  const queues = buildDefaultQueues();
  const workItems = [];
  const assignments = [];

  const metrics = computeWorkMetrics({
    workItems,
    assignments,
    nowISO: String(nowISO ?? "2026-07-01T00:00:00.000Z"),
  });

  return deepFreeze({
    workItems,
    stages,
    queues,
    assignments,
    metrics,
  });
}

// Convenience factory for work item creation in tests/usage.
export function buildWorkItemForSeed({ nowISO, overrides } = {}) {
  const createdAt = String(overrides?.createdAt ?? nowISO ?? "2026-07-01T00:00:00.000Z");
  const updatedAt = String(overrides?.updatedAt ?? createdAt);

  return createWorkItem({
    id: String(overrides?.id ?? "wi_seed"),
    title: String(overrides?.title ?? "Seed Work Item"),
    description: String(overrides?.description ?? "Deterministic seed work item."),
    workType: String(overrides?.workType ?? "work"),
    status: String(overrides?.status ?? "new"),
    priority: String(overrides?.priority ?? "medium"),
    stageId: String(overrides?.stageId ?? "stage_intake"),
    queueId: String(overrides?.queueId ?? "queue_needs_review"),
    assignedTo: String(overrides?.assignedTo ?? "unassigned"),
    requestedBy: String(overrides?.requestedBy ?? "owner"),
    source: String(overrides?.source ?? "seed"),
    dueAt: overrides?.dueAt ?? createdAt,
    createdAt,
    updatedAt,
    completedAt: overrides?.completedAt ?? null,
    blockedReason: overrides?.blockedReason ?? null,
    relatedObjects: Array.isArray(overrides?.relatedObjects) ? overrides.relatedObjects : [],
    requirements: Array.isArray(overrides?.requirements) ? overrides.requirements : [],
    metadata: deepFreeze(overrides?.metadata ?? {}),
  });
}

