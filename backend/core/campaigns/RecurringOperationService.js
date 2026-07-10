import { CampaignPreparationService } from "./CampaignPreparationService.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key ?? "").split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function dueDateForOperation(operation, now) {
  const cadence = operation?.cadence ?? {};
  const frequency = String(cadence.frequency ?? "");
  const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (frequency === "weekly") {
    const target = Number(cadence.dayOfWeek ?? 1);
    const diff = (due.getUTCDay() - target + 7) % 7;
    due.setUTCDate(due.getUTCDate() - diff);
    return due;
  }
  if (frequency === "monthly") {
    const day = Math.max(1, Math.min(28, Number(cadence.dayOfMonth ?? 1)));
    due.setUTCDate(day);
    if (due > now) due.setUTCMonth(due.getUTCMonth() - 1);
    return due;
  }
  return due;
}

function nextDateAfterOperationOccurrence(operation, occurrenceKey) {
  const cadence = operation?.cadence ?? {};
  const latest = dateFromKey(occurrenceKey);
  if (!latest) return null;
  const frequency = String(cadence.frequency ?? "");
  const interval = Math.max(1, Number(cadence.interval ?? 1));
  const next = new Date(latest.getTime());
  if (frequency === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7 * interval);
    return next;
  }
  if (frequency === "monthly") {
    next.setUTCMonth(next.getUTCMonth() + interval);
    return next;
  }
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function isDue(operation, now) {
  if (operation?.enabled === false) return false;
  if (operation?.startsAt && new Date(String(operation.startsAt)).getTime() > now.getTime()) return false;
  return dueDateForOperation(operation, now).getTime() <= now.getTime();
}

function findTemplate(templates, id) {
  return safeArray(templates).find((template) => String(template.id) === String(id)) ?? null;
}

function newestWork(items) {
  return safeArray(items).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null;
}

export function materializeDueRecurringOperations({
  stack,
  businessId,
  operationDefinitions,
  campaignTemplates,
  nowISO = new Date().toISOString(),
} = {}) {
  const now = new Date(String(nowISO));
  const service = new CampaignPreparationService();
  const results = [];
  const snapshotKinds = new Set();

  for (const operation of safeArray(operationDefinitions)) {
    if (!isDue(operation, now)) {
      results.push({ operationId: String(operation.id), materialized: false, reason: operation?.enabled === false ? "paused" : "not_due" });
      continue;
    }
    const templateId = operation?.produces?.campaignTemplateId;
    const template = findTemplate(campaignTemplates, templateId);
    if (!template) {
      results.push({ operationId: String(operation.id), materialized: false, reason: "template_missing" });
      continue;
    }
    const occurrenceKey = dateKey(dueDateForOperation(operation, now));
    const result = service.execute({
      stack,
      businessId,
      campaignTemplate: template,
      operation,
      occurrenceKey,
      nowISO,
    });
    for (const kind of result.snapshotKinds ?? []) snapshotKinds.add(kind);
    results.push({ operationId: String(operation.id), occurrenceKey, materialized: !result.idempotent, ...result });
  }

  return { ok: true, results, snapshotKinds: [...snapshotKinds] };
}

export function recurringOperationStatus({ operationDefinitions, workRuntime, nowISO = new Date().toISOString() } = {}) {
  const now = new Date(String(nowISO));
  return safeArray(operationDefinitions).map((operation) => {
    const due = dueDateForOperation(operation, now);
    const opId = String(operation.id);
    const work = safeArray(workRuntime?.getWorkItems?.()).filter(
      (item) => String(item?.metadata?.campaignPreparation?.operationId ?? "") === opId,
    );
    const latest = newestWork(work);
    const latestActiveReview = newestWork(work.filter((item) => String(item?.status) === "review_required"));
    const selected = latestActiveReview ?? latest;
    const latestOccurrence = latest?.metadata?.campaignPreparation?.occurrenceKey ?? null;
    const nextDue = latestOccurrence ? nextDateAfterOperationOccurrence(operation, latestOccurrence) : due;
    return {
      id: opId,
      name: String(operation.name ?? opId),
      cadence: operation.cadence ?? {},
      enabled: operation.enabled !== false,
      description: String(operation.description ?? ""),
      campaignTemplateId: operation?.produces?.campaignTemplateId ? String(operation.produces.campaignTemplateId) : null,
      nextDueAt: dateKey(nextDue ?? due),
      lastOccurrence: latestOccurrence,
      status: selected ? String(selected.status) : isDue(operation, now) ? "due" : "scheduled",
      workId: selected?.id ?? null,
    };
  });
}
