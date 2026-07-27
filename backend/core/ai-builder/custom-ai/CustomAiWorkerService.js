import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { WorkCreationService } from "../../pipelines/request-to-work/WorkCreationService.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";
import {
  CUSTOM_AI_CAPABILITY_ID,
  CUSTOM_AI_WORK_TYPE,
} from "./CustomAiWorkerCompiler.js";
import { composeSpecialtyArtifact } from "../specialty/SpecialtyArtifactComposer.js";
import { consultSpecialtySources } from "../specialty/consultSpecialtySources.js";

/**
 * Universal Custom AI Worker — runs any custom AI specialty as durable Work + artifacts.
 * Never sends outbound communications; drafts only with approval required.
 * Specialty jobs stay open for owner review (appear on Work).
 * Session content must come from consulted Knowledge + authority packs.
 */
export class CustomAiWorkerService {
  /** @param {{workCreationService?: any, nowISO?: (() => string) | string, fetchImpl?: typeof fetch | null, packFixtures?: object | null}} options */
  constructor({
    workCreationService = new WorkCreationService(),
    nowISO = () => new Date().toISOString(),
    fetchImpl = null,
    packFixtures = null,
  } = {}) {
    this.workCreationService = workCreationService;
    this.nowISO = typeof nowISO === "function" ? nowISO : () => String(nowISO);
    this.fetchImpl = fetchImpl;
    this.packFixtures = packFixtures;
  }

  /**
   * @param {{
   *   workRuntime: object,
   *   employee: object,
   *   brief?: string,
   *   actorId?: string,
   *   businessId?: string,
   *   knowledgeDocuments?: object[],
   *   industryHints?: string[],
   *   consultResult?: object|null,
   * }} params
   */
  async runJob({
    workRuntime,
    employee,
    brief = "",
    actorId = "owner",
    businessId = null,
    knowledgeDocuments = [],
    industryHints = [],
    consultResult: providedConsult = null,
  } = {}) {
    if (!workRuntime) {
      return deepFreeze({ ok: false, reason: "work_runtime_required" });
    }
    const employeeId = String(employee?.employeeId ?? employee?.id ?? "").trim();
    if (!employeeId) {
      return deepFreeze({ ok: false, reason: "employee_required" });
    }

    const capabilities = Array.isArray(employee?.capabilities) ? employee.capabilities.map(String) : [];
    const ownerAdded = Boolean(
      employee?.ownerAdded
      || employeeId.startsWith("owner_emp_")
      || capabilities.includes(CUSTOM_AI_CAPABILITY_ID),
    );
    if (!ownerAdded && !capabilities.includes(CUSTOM_AI_CAPABILITY_ID)) {
      return deepFreeze({ ok: false, reason: "not_custom_ai_employee" });
    }

    const label = String(employee.label ?? employee.name ?? employeeId);
    const purpose = String(employee.purpose ?? employee.role ?? label);
    const instruction = String(brief ?? "").trim() || `Prepare the next deliverable for: ${purpose}`;
    const now = this.nowISO();
    // Keep IDs unique even when workspace clock is frozen for demos/tests.
    const stamp = `${now.replace(/[^0-9]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
    const workItemId = `work_custom_${employeeId}_${stamp}`.slice(0, 96);

    const consultResult = providedConsult ?? await consultSpecialtySources({
      label,
      purpose,
      instruction,
      businessId,
      knowledgeDocuments,
      industryHints,
      fetchImpl: this.fetchImpl,
      packFixtures: this.packFixtures,
      nowISO: now,
    });

    const artifact = composeSpecialtyArtifact({
      label,
      purpose,
      instruction,
      nowISO: now,
      templateId: employee?.artifactTemplateId ?? employee?.specialtyArtifactTemplateId ?? null,
      consultResult,
    });

    const sourceRefs = deepFreeze((artifact.sources ?? consultResult.sources ?? []).map((source) => ({
      id: source.id,
      org: source.org,
      title: source.title,
      url: source.url ?? null,
      knowledgeDocId: source.knowledgeDocId ?? null,
      provenance: source.provenance,
      packId: source.packId ?? null,
    })));

    const workItemInput = {
      id: workItemId,
      title: artifact.title || `${label}: ${truncate(instruction, 72)}`,
      description: instruction,
      workType: CUSTOM_AI_WORK_TYPE,
      status: "ready",
      priority: "high",
      stageId: "stage_intake",
      queueId: "queue_needs_review",
      assignedTo: employeeId,
      requestedBy: String(actorId),
      source: "custom_ai_worker",
      dueAt: null,
      completedAt: null,
      blockedReason: null,
      relatedObjects: [],
      requirements: [],
      createdAt: now,
      updatedAt: now,
      metadata: deepFreeze({
        customAi: true,
        employeeId,
        purpose,
        businessId: businessId ? String(businessId) : null,
        artifact,
        sourceRefs,
        consultSummary: artifact.consultSummary ?? null,
        outboundRequiresApproval: true,
        display: {
          workTypeLabel: artifact.templateId === "session_flow"
            ? "Session plan"
            : artifact.templateId === "checklist_run"
              ? "Checklist"
              : artifact.templateId === "outreach_sequence"
                ? "Outreach sequence"
                : "Specialty deliverable",
          statusLabel: artifact.gaps?.length ? "Needs sources" : "Needs review",
          nextStep: artifact.gaps?.length
            ? "Attach curriculum in Knowledge, then re-run"
            : "Review the specialty deliverable",
          assigneeName: label,
          rowHref: businessId ? `/b/${businessId}/work?workId=${encodeURIComponent(workItemId)}` : null,
        },
      }),
    };

    let created = this.workCreationService.createWorkItem({
      workRuntime,
      workItemInput,
      requestConvertedEventId: `custom_ai_${employeeId}_${stamp}`,
      convertedAtISO: now,
    });

    // If a prior frozen-clock id already exists, force an update path instead of failing the run.
    if (created.status !== "SUCCESS") {
      const existing = workRuntime.getWorkItem?.(workItemId) ?? null;
      if (existing) {
        workRuntime.applyEvent({
          id: `evt_${workItemId}_recreate_${stamp}`,
          timestampISO: now,
          type: WORK_EVENT_TYPES.WORK_ITEM_UPDATED,
          source: "custom_ai_worker",
          payload: {
            workItemId,
            patch: {
              title: workItemInput.title,
              description: instruction,
              status: "ready",
              completedAt: null,
              metadata: workItemInput.metadata,
            },
          },
        });
        created = { status: "SUCCESS", workItemId, errors: [] };
      }
    }

    if (created.status !== "SUCCESS") {
      return deepFreeze({
        ok: false,
        reason: "work_create_failed",
        errors: created.errors ?? [],
      });
    }

    // Ensure artifact + display stay attached after create (creation path may slim metadata).
    workRuntime.applyEvent({
      id: `evt_${workItemId}_artifact`,
      timestampISO: now,
      type: WORK_EVENT_TYPES.WORK_ITEM_UPDATED,
      source: "custom_ai_worker",
      payload: {
        workItemId,
        patch: {
          title: workItemInput.title,
          status: "ready",
          metadata: workItemInput.metadata,
        },
      },
    });

    const workHref = businessId
      ? `/b/${businessId}/work?workId=${encodeURIComponent(workItemId)}`
      : null;

    return deepFreeze({
      ok: true,
      workItemId,
      employeeId,
      artifact,
      sourceRefs,
      consultResult,
      workHref,
      note: artifact.gaps?.length
        ? "Specialty structure is ready, but curriculum sources are missing. Attach Knowledge or use a matching authority pack, then re-run."
        : "Specialty deliverable is ready for owner review on Work. Outbound still requires approval.",
    });
  }
}

function truncate(text, max) {
  const value = String(text ?? "");
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
