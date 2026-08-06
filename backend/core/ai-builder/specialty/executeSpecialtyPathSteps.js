/**
 * Execute automation path steps at fire time.
 * Manual steps wait for the owner (Needs you). Auto steps run now.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  readCrmState,
  writeCrmState,
  upsertPipelineCard,
} from "../../crm/CrmStore.js";
import {
  normalizeAutomationPath,
  PATH_STEP_TYPES,
  stepIsManual,
} from "../operating-contract/automationPath.js";
import { computeStepReadiness } from "../operating-contract/automationPathReadiness.js";
import { createApprovalRequest } from "../../approvals/ApprovalRequest.js";
import { APPROVAL_INTERNAL_EVENT_TYPES } from "../../approvals/ApprovalEventTypes.js";
import { resolveMessagePersonalization } from "./resolveMessagePersonalization.js";
import { sendSpecialtyOutbound } from "./specialtyOutbound.js";
import { inferActionClass, isClassAutoEligible, readEarnedAutonomy } from "../../company-rules/earnedAutonomy.js";

function classAllowsAutoSend(installation, classId) {
  if (!installation || !classId) return false;
  // Trust last evaluated snapshot + owner delegation for live path (Plan 22).
  const row = readEarnedAutonomy(installation).classes[String(classId)];
  if (row?.lastStatus === "auto_eligible" && row.delegatedAt && !row.revokedAt) {
    return true;
  }
  return isClassAutoEligible(installation, classId);
}
export async function executeSpecialtyPathSteps({
  employee = {},
  installation = null,
  platformStore = null,
  businessId = null,
  actorId = "system",
  eventPayload = {},
  brief = "",
  approvalRuntime = null,
  workItemId = null,
  workItem = null,
  integrationHub = null,
  sendEmail = null,
  sendSms = null,
  platformJobQueue = null,
  readinessSnapshot = null,
  nowISO = () => new Date().toISOString(),
  executionMode = "live",
} = {}) {
  const path = normalizeAutomationPath(employee?.operatingContract?.automationPath, {
    contract: employee?.operatingContract ?? {},
  });
  const steps = Array.isArray(path?.steps)
    ? path.steps.filter((s) => s && s.enabled !== false).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];

  const mode = String(executionMode ?? "live");
  const nonLive = mode === "shadow" || mode === "replay";
  const notes = [];
  let crmTouched = false;
  let crm = installation ? readCrmState(installation) : null;
  const at = typeof nowISO === "function" ? nowISO() : String(nowISO);
  const snapshot = readinessSnapshot && typeof readinessSnapshot === "object"
    ? readinessSnapshot
    : { businessId, connections: [], connectedTypes: [], crmAvailable: Boolean(installation && platformStore) };

  for (const step of steps) {
    const type = String(step.type ?? "");
    const manual = stepIsManual(step);

    if (type === PATH_STEP_TYPES.ADD_TO_PIPELINE) {
      if (nonLive) {
        notes.push({
          stepId: step.id,
          type,
          ok: true,
          deferred: false,
          needsYou: false,
          reason: `${mode}_proposed_no_crm_write`,
          label: step.label,
          executionMode: mode,
          message: `${mode} mode — pipeline card not written externally.`,
        });
        continue;
      }
      if (manual) {
        notes.push({
          stepId: step.id,
          type,
          ok: true,
          deferred: true,
          needsYou: true,
          reason: "awaiting_owner_manual",
          label: step.label,
          message: "Manual pipeline step — confirm in Needs you / Work before the card is added.",
        });
        continue;
      }
      if (!String(step.label ?? "").trim()) {
        notes.push({
          stepId: step.id,
          type,
          ok: false,
          reason: "pipeline_step_needs_label",
          label: step.label,
          message: "Add a label on this path step before it can change Pipelines automatically.",
        });
        continue;
      }
      if (!crm || !platformStore || !installation) {
        notes.push({
          stepId: step.id,
          type,
          ok: false,
          reason: "crm_unavailable",
          label: step.label,
        });
        continue;
      }
      const pipelineLabel = String(step.pipelineLabel ?? "").trim().toLowerCase();
      const pipelines = crm.pipelines ?? [];
      const pipe = pipelines.find((p) => String(p.name ?? "").trim().toLowerCase() === pipelineLabel)
        || pipelines[0]
        || null;
      if (!pipe) {
        notes.push({
          stepId: step.id,
          type,
          ok: false,
          reason: "no_pipeline",
          label: step.label,
        });
        continue;
      }
      const stageId = pipe.stages?.[0]?.id;
      const title = String(
        eventPayload?.title
          || eventPayload?.cardTitle
          || brief
          || step.label
          || "Automation lead",
      ).trim().slice(0, 160) || "Automation lead";

      const upserted = upsertPipelineCard(crm, {
        pipelineId: pipe.id,
        card: {
          title,
          stageId,
          contactId: eventPayload?.contactId ?? "",
          value: 0,
        },
      });
      crm = upserted.crm;
      crmTouched = true;
      notes.push({
        stepId: step.id,
        type,
        ok: true,
        pipelineId: pipe.id,
        pipelineName: pipe.name,
        cardId: upserted.cardId,
        title,
        label: step.label,
        runMode: "auto",
      });
      continue;
    }

    if (type === PATH_STEP_TYPES.CREATE_DRAFT) {
      notes.push({
        stepId: step.id,
        type,
        ok: true,
        deferred: true,
        needsYou: manual,
        reason: manual ? "awaiting_owner_review" : "draft_auto",
        label: step.label,
        runMode: manual ? "manual" : "auto",
      });
      continue;
    }

    if (type === PATH_STEP_TYPES.SOCIAL_SCREEN) {
      if (manual) {
        notes.push({
          stepId: step.id,
          type,
          ok: true,
          deferred: true,
          needsYou: true,
          reason: "awaiting_owner_manual",
          label: step.label,
          message: "Manual social screen — confirm in Needs you before research runs.",
        });
        continue;
      }
      const subjectName = String(
        eventPayload?.name
        ?? eventPayload?.subjectName
        ?? eventPayload?.contact?.name
        ?? "",
      ).trim();
      if (!subjectName || !businessId) {
        notes.push({
          stepId: step.id,
          type,
          ok: false,
          reason: "subject_name_required",
          label: step.label,
          message: "Provide a person name (from People) to run a social background screen.",
        });
        continue;
      }
      if (platformJobQueue?.enqueue) {
        try {
          const job = await platformJobQueue.enqueue({
            businessId: String(businessId),
            jobType: "social_background_screen",
            idempotencyKey: `social_screen_${businessId}_${subjectName}_${at}`.slice(0, 120),
            payload: {
              subjectName,
              name: subjectName,
              email: eventPayload?.email ?? eventPayload?.contact?.email ?? "",
              phone: eventPayload?.phone ?? eventPayload?.contact?.phone ?? "",
              handles: eventPayload?.handles ?? [],
              contactId: eventPayload?.contactId ?? eventPayload?.contact?.id ?? null,
              employeeId: String(employee?.employeeId ?? employee?.id ?? "emp_social_background_screener_default"),
            },
          });
          notes.push({
            stepId: step.id,
            type,
            ok: true,
            deferred: true,
            needsYou: false,
            reason: "social_screen_enqueued",
            label: step.label,
            runMode: "auto",
            jobId: job?.id ?? null,
          });
        } catch (err) {
          notes.push({
            stepId: step.id,
            type,
            ok: false,
            reason: "social_screen_enqueue_failed",
            label: step.label,
            message: err instanceof Error ? err.message : String(err),
          });
        }
        continue;
      }
      notes.push({
        stepId: step.id,
        type,
        ok: false,
        reason: "job_queue_unavailable",
        label: step.label,
        message: "Job queue unavailable — use People → Run social background screen.",
      });
      continue;
    }

    if (
      type === PATH_STEP_TYPES.SEND_EMAIL
      || type === PATH_STEP_TYPES.SEND_SMS
      || type === PATH_STEP_TYPES.NOTIFY_TEAM
    ) {
      if (nonLive) {
        const channels = resolveChannels(step, type);
        const recipients = resolveStepRecipients(step, eventPayload);
        notes.push({
          stepId: step.id,
          type,
          ok: true,
          deferred: false,
          needsYou: false,
          reason: `${mode}_proposed_no_outbound`,
          label: step.label,
          runMode: manual ? "manual" : "auto",
          executionMode: mode,
          shadowProposal: {
            channels,
            recipients,
            subject: step.subject || "Update",
            bodyPreview: String(step.body || "").slice(0, 280),
          },
          message: `${mode} mode — outbound not sent.`,
        });
        continue;
      }

      const readiness = computeStepReadiness(step, snapshot);
      if (!readiness.ready) {
        const top = readiness.blockers[0] ?? null;
        notes.push({
          stepId: step.id,
          type,
          ok: false,
          deferred: false,
          needsYou: false,
          reason: String(top?.code ?? "channel_not_ready"),
          label: step.label,
          message: String(top?.label ?? "Connect the required channel before this step can run."),
          href: top?.href ?? null,
          blockers: readiness.blockers,
        });
        continue;
      }

      let approvalId = null;
      const direction = String(step.direction ?? (type === PATH_STEP_TYPES.NOTIFY_TEAM ? "internal" : "external"));
      // Plan 22 — external auto still requires owner GRANT unless the action class
      // earned auto-eligibility (delegated). Never silent-send when ineligible.
      const actionClassId = inferActionClass({
        event: eventPayload,
        title: step.label ?? workItem?.title ?? brief ?? type,
      });
      const classAutoEligible = Boolean(
        installation && actionClassId && classAllowsAutoSend(installation, actionClassId),
      );
      const forceApprovalForExternalAuto =
        direction === "external"
        && !manual
        && type !== PATH_STEP_TYPES.NOTIFY_TEAM
        && !classAutoEligible;
      const needsOwnerGrant = direction === "external" && (manual || forceApprovalForExternalAuto);

      if (manual && !needsOwnerGrant) {
        // Manual internal / team alert — wait in Needs you; don't auto-send.
        notes.push({
          stepId: step.id,
          type,
          ok: true,
          deferred: true,
          needsYou: true,
          reason: "awaiting_owner_manual",
          approvalId: null,
          label: step.label,
          runMode: "manual",
        });
        continue;
      }

      if (needsOwnerGrant && approvalRuntime?.applyEvent && workItemId) {
        approvalId = `apr_specialty_${String(workItemId).slice(0, 24)}_${String(step.id).slice(0, 24)}`;
        const existing = approvalRuntime.getRequestById?.(approvalId);
        if (!existing) {
          try {
            const resolvedSubject = resolveMessagePersonalization(step.subject ?? "", eventPayload);
            const resolvedBody = resolveMessagePersonalization(step.body ?? "", eventPayload);
            approvalRuntime.applyEvent({
              id: `evt_approval_requested_${approvalId}_${at.replace(/[^0-9]/g, "").slice(0, 14)}`,
              timestampISO: at,
              type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_REQUESTED,
              payload: {
                request: createApprovalRequest({
                  id: approvalId,
                  requestType: type === PATH_STEP_TYPES.SEND_SMS ? "specialty_sms" : "specialty_email",
                  source: "specialty_automation",
                  sourceReference: {
                    workItemId: String(workItemId),
                    stepId: String(step.id),
                    employeeId: String(employee?.employeeId ?? employee?.id ?? ""),
                    businessId: String(businessId ?? ""),
                  },
                  status: "PENDING",
                  requestedAt: at,
                  requestedBy: String(actorId || "specialty_automation"),
                  requiredApprover: "role:owner",
                  context: {
                    workItemId: String(workItemId),
                    relatedWorkId: String(workItemId),
                    channel: type === PATH_STEP_TYPES.SEND_SMS ? "sms" : "email",
                    label: String(step.label ?? type),
                    audience: String(step.audience ?? ""),
                    subject: resolvedSubject,
                    bodyPreview: resolvedBody.slice(0, 500),
                    triggeredBy: String(employee?.displayName ?? employee?.name ?? employee?.employeeId ?? "AI teammate"),
                  },
                  metadata: {
                    specialtyPath: true,
                    relatedWorkId: String(workItemId),
                    workItemId: String(workItemId),
                    channel: type === PATH_STEP_TYPES.SEND_SMS ? "sms" : "email",
                    bodyTemplate: String(step.body ?? ""),
                  },
                }),
              },
            });
          } catch {
            approvalId = null;
          }
        }
        notes.push({
          stepId: step.id,
          type,
          ok: true,
          deferred: true,
          needsYou: true,
          reason: approvalId ? "awaiting_owner_grant" : "awaiting_approval_or_draft",
          approvalId,
          label: step.label,
          runMode: "manual",
        });
        continue;
      }

      // Auto (or internal): send now when recipients / adapters allow.
      const channels = resolveChannels(step, type);
      const recipients = resolveStepRecipients(step, eventPayload);
      const personalizationWork = {
        ...(workItem ?? {}),
        id: workItemId ?? workItem?.id ?? null,
        title: workItem?.title ?? step.label ?? "Update",
        metadata: {
          ...(workItem?.metadata ?? {}),
          eventPayload: workItem?.metadata?.eventPayload ?? eventPayload,
          personalization: workItem?.metadata?.personalization ?? eventPayload,
          contact: workItem?.metadata?.contact ?? (eventPayload ? {
            name: eventPayload.name ?? null,
            email: eventPayload.email ?? null,
            phone: eventPayload.phone ?? null,
          } : null),
        },
      };

      if (!recipients.length) {
        notes.push({
          stepId: step.id,
          type,
          ok: true,
          deferred: true,
          needsYou: false,
          reason: "auto_send_no_recipients",
          label: step.label,
          runMode: "auto",
          executionMode: mode,
        });
        continue;
      }

      if (nonLive) {
        notes.push({
          stepId: step.id,
          type,
          ok: true,
          deferred: false,
          needsYou: false,
          reason: `${mode}_proposed_no_outbound`,
          label: step.label,
          runMode: "auto",
          executionMode: mode,
          shadowProposal: {
            channels,
            recipients,
            subject: step.subject || personalizationWork.title || "Update",
            bodyPreview: String(step.body || "").slice(0, 280),
          },
          message: `${mode} mode — outbound not sent.`,
        });
        continue;
      }

      try {
        const sent = await sendSpecialtyOutbound({
          businessId,
          workItem: personalizationWork,
          channels,
          recipients,
          emailSubject: step.subject || personalizationWork.title || "Update",
          emailBody: step.body || "",
          smsBody: step.body || "",
          outboundApproved: true,
          integrationHub,
          sendEmail,
          sendSms,
        });
        notes.push({
          stepId: step.id,
          type,
          ok: Boolean(sent?.ok),
          deferred: false,
          needsYou: false,
          reason: sent?.ok
            ? (classAutoEligible ? "auto_sent_earned_autonomy" : "auto_sent")
            : (sent?.reason ?? "auto_send_failed"),
          label: step.label,
          runMode: "auto",
          executionMode: mode,
          actionClassId,
          classAutoEligible,
          send: sent,
        });
      } catch (err) {
        notes.push({
          stepId: step.id,
          type,
          ok: false,
          deferred: false,
          needsYou: false,
          reason: err instanceof Error ? err.message : "auto_send_failed",
          label: step.label,
          runMode: "auto",
          executionMode: mode,
        });
      }
      continue;
    }

    notes.push({
      stepId: step.id,
      type,
      ok: false,
      reason: "unsupported_step",
      label: step.label,
    });
  }

  if (crmTouched && platformStore && installation && businessId) {
    await writeCrmState({
      platformStore,
      installation,
      crm,
      actorId,
    });
  }

  const needsYou = notes.some((n) => n.needsYou);
  const hardFailed = notes.some((n) => n.ok === false);
  return deepFreeze({
    ok: !hardFailed,
    notes,
    needsYou,
    executedCount: notes.filter((n) => n.ok && !n.deferred).length,
    deferredCount: notes.filter((n) => n.deferred).length,
    failedCount: notes.filter((n) => n.ok === false).length,
  });
}

function resolveChannels(step, type) {
  if (Array.isArray(step.channels) && step.channels.length) {
    return [...new Set(step.channels.map(String).filter((c) => c === "email" || c === "sms"))];
  }
  if (type === PATH_STEP_TYPES.SEND_SMS) return ["sms"];
  if (type === PATH_STEP_TYPES.SEND_EMAIL || type === PATH_STEP_TYPES.NOTIFY_TEAM) return ["email"];
  return ["email"];
}

function resolveStepRecipients(step, eventPayload = {}) {
  const people = Array.isArray(step.people) ? step.people : [];
  const fromStructured = people
    .map((person) => ({
      name: person?.name ?? null,
      email: person?.email ?? null,
      phone: person?.phone ?? null,
      address: person?.email ?? null,
    }))
    .filter((person) => person.email || person.phone);
  if (fromStructured.length) return fromStructured;

  const custom = String(step.customRecipients ?? "")
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (
      part.includes("@")
        ? { email: part, address: part }
        : { phone: part }
    ));
  if (custom.length) return custom;

  const audience = String(step.audience ?? "");
  if (audience === "submitter" || audience === "scope_who" || !audience) {
    const email = String(eventPayload?.email ?? eventPayload?.contact?.email ?? "").trim();
    const phone = String(eventPayload?.phone ?? eventPayload?.contact?.phone ?? "").trim();
    if (email || phone) {
      return [{
        name: eventPayload?.name ?? eventPayload?.contact?.name ?? null,
        email: email || null,
        phone: phone || null,
        address: email || null,
      }];
    }
  }
  return [];
}
