import { AUTOMATION_INTERNAL_EVENT_TYPES } from "./AutomationEventTypes.js";
import { AUTOMATION_RUN_STATUSES } from "./AutomationRun.js";
import { resolveAutomationParameters } from "./engine/AutomationValueResolver.js";
import { ACTION_EXECUTION_STATUSES, createAutomationActionExecutionResult } from "./actions/AutomationActionExecutionResult.js";
import { APPROVAL_INTERNAL_EVENT_TYPES } from "../approvals/ApprovalEventTypes.js";
import { createApprovalRequest } from "../approvals/ApprovalRequest.js";
import { isOutboundAutomationAction } from "../approvals/OutboundApprovalGate.js";

function fail(message) {
  throw new Error(`AutomationOrchestrationService: ${message}`);
}

function safeIdComponent(s) {
  return String(s ?? "").replace(/[^a-zA-Z0-9_]/g, "_");
}

function deterministicAutomationRunId({ automationId, triggerEventId } = {}) {
  if (!automationId) fail("deterministicAutomationRunId requires automationId.");
  if (!triggerEventId) fail("deterministicAutomationRunId requires triggerEventId.");
  return `run_${safeIdComponent(automationId)}_${safeIdComponent(triggerEventId)}`;
}

function deterministicApprovalId({ runId, actionId } = {}) {
  return `approval_${safeIdComponent(runId)}_${safeIdComponent(actionId)}`;
}

function toSortedByOrderThenId(actions) {
  const copy = [...(actions ?? [])];
  copy.sort((a, b) => {
    const ao = Number(a?.order ?? 0);
    const bo = Number(b?.order ?? 0);
    if (ao !== bo) return ao - bo;
    return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  });
  return copy;
}

function deepFreeze(v) {
  if (!v || typeof v !== "object") return v;
  if (Object.isFrozen(v)) return v;
  for (const k of Object.keys(v)) deepFreeze(v[k]);
  return Object.freeze(v);
}

function actionAlreadyCompleted({ executionResults, actionId } = {}) {
  return (executionResults ?? []).some(
    (r) => String(r?.actionId) === String(actionId) && String(r?.status) === ACTION_EXECUTION_STATUSES.COMPLETED,
  );
}

export class AutomationOrchestrationService {
  constructor({
    automationRuntime,
    automationRuleEngine,
    actionExecutorRegistry,
    interactionRuntime,
    automationPlatformEventPublisher,
    approvalRuntime,
    approvalPlatformEventPublisher,
  } = {}) {
    if (!automationRuntime) fail("automationRuntime required.");
    if (!automationRuleEngine) fail("automationRuleEngine required.");
    if (!actionExecutorRegistry) fail("actionExecutorRegistry required.");
    if (!interactionRuntime) fail("interactionRuntime required.");
    this.automationRuntime = automationRuntime;
    this.automationRuleEngine = automationRuleEngine;
    this.actionExecutorRegistry = actionExecutorRegistry;
    this.interactionRuntime = interactionRuntime;
    this.automationPlatformEventPublisher = automationPlatformEventPublisher;
    this.approvalRuntime = approvalRuntime ?? null;
    this.approvalPlatformEventPublisher = approvalPlatformEventPublisher ?? null;
  }

  orchestratePlatformEvent({ platformEvent, context } = {}) {
    const event = platformEvent;
    if (!event || typeof event !== "object") fail("platformEvent required.");
    const nowISO = String(context?.nowISO ?? "2026-07-01T00:00:00.000Z");
    const workRuntime = context?.workRuntime;
    if (!workRuntime) fail("context.workRuntime required.");

    const matchResult = this.automationRuleEngine.matchEvent({
      event,
      automationRuntime: this.automationRuntime,
    });

    const matched = Array.isArray(matchResult.matchedAutomations) ? matchResult.matchedAutomations : [];
    if (!matched.length) {
      return deepFreeze({
        status: "SKIPPED",
        message: "No matching active automations.",
        automationRunsCreated: 0,
      });
    }

    let totalRunsCreated = 0;

    for (const m of matched) {
      const automation = m.automation;
      const automationId = String(automation.id);
      const triggerEventId = String(event.eventId);
      const runId = deterministicAutomationRunId({ automationId, triggerEventId });

      const existing = this.automationRuntime.getRunById(runId);
      if (existing) continue;

      const plannedActions = this.planActionsForAutomation({
        automation,
        event,
        nowISO,
      });

      const run = {
        id: runId,
        automationId,
        triggerEventId,
        triggerEventType: String(event.eventType),
        status: AUTOMATION_RUN_STATUSES.RUNNING,
        matchedConditions: m.matchedConditions ?? [],
        plannedActions,
        executionResults: [],
        startedAt: nowISO,
        completedAt: null,
        error: null,
        metadata: { derivedFrom: { eventId: String(event.eventId), eventType: String(event.eventType) } },
      };

      this.automationRuntime.applyEvent({
        id: `evt_auto_run_started_${runId}`,
        timestampISO: nowISO,
        type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_RUN_STARTED,
        payload: { run },
      });

      totalRunsCreated += 1;

      this.automationPlatformEventPublisher?.publishAutomationRunStarted?.({
        runId,
        automationId,
        occurredAtISO: nowISO,
        triggerEventId,
      });

      const outcome = this._executePlannedActions({
        runId,
        automationId,
        triggerEventId,
        plannedActions,
        nowISO,
        workRuntime,
      });

      if (outcome.waitingForApproval) continue;
      if (outcome.failed) continue;
    }

    return deepFreeze({
      status: "SUCCESS",
      message: "Automation orchestration completed.",
      automationRunsCreated: totalRunsCreated,
    });
  }

  resumeAfterApproval({ platformEvent, context } = {}) {
    const event = platformEvent;
    if (!event || typeof event !== "object") fail("platformEvent required.");
    const approvalId = String(event?.payload?.approvalId ?? "");
    if (!approvalId) fail("payload.approvalId required.");
    if (!this.approvalRuntime) fail("approvalRuntime required for resumeAfterApproval.");

    const nowISO = String(context?.nowISO ?? "2026-07-01T00:00:00.000Z");
    const workRuntime = context?.workRuntime;
    if (!workRuntime) fail("context.workRuntime required.");

    const approval = this.approvalRuntime.getRequestById(approvalId);
    if (!approval || String(approval.status) !== "GRANTED") {
      return deepFreeze({ status: "SKIPPED", message: "Approval not granted." });
    }

    const runId = String(approval.sourceReference?.runId ?? "");
    const actionId = String(approval.sourceReference?.actionId ?? "");
    if (!runId || !actionId) fail("approval sourceReference must include runId and actionId.");

    const run = this.automationRuntime.getRunById(runId);
    if (!run || String(run.status) !== AUTOMATION_RUN_STATUSES.WAITING_FOR_APPROVAL) {
      return deepFreeze({ status: "SKIPPED", message: "Run not waiting for approval." });
    }

    if (actionAlreadyCompleted({ executionResults: run.executionResults, actionId })) {
      return deepFreeze({ status: "SKIPPED", message: "Action already completed." });
    }

    const plannedAction = (run.plannedActions ?? []).find((a) => String(a.id) === actionId);
    if (!plannedAction) fail(`planned action not found: ${actionId}`);

    const executionResults = [...(run.executionResults ?? [])];
    const res = this.actionExecutorRegistry.execute({
      action: plannedAction,
      context: {
        nowISO,
        workRuntime,
        interactionRuntime: this.interactionRuntime,
        triggerEventId: String(run.triggerEventId),
        approvalGranted: true,
      },
    });

    const idx = executionResults.findIndex((r) => String(r?.actionId) === actionId);
    if (idx >= 0) executionResults[idx] = res;
    else executionResults.push(res);

    const automationId = String(run.automationId);
    const triggerEventId = String(run.triggerEventId);

    if (String(res.status) === ACTION_EXECUTION_STATUSES.FAILED) {
      this.automationRuntime.applyEvent({
        id: `evt_auto_run_failed_${runId}_${nowISO}`,
        timestampISO: nowISO,
        type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_RUN_FAILED,
        payload: {
          runId,
          executionResults,
          failedAt: nowISO,
          error: res.error ?? "Automation run action failed after approval.",
        },
      });
      this.automationPlatformEventPublisher?.publishAutomationRunFailed?.({
        runId,
        automationId,
        occurredAtISO: nowISO,
        triggerEventId,
      });
      return deepFreeze({ status: "FAILED", runId, actionId });
    }

    this.automationRuntime.applyEvent({
      id: `evt_auto_run_completed_${runId}_${nowISO}`,
      timestampISO: nowISO,
      type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_RUN_COMPLETED,
      payload: { runId, executionResults, completedAt: nowISO },
    });
    this.automationPlatformEventPublisher?.publishAutomationRunCompleted?.({
      runId,
      automationId,
      occurredAtISO: nowISO,
      triggerEventId,
    });

    return deepFreeze({ status: "SUCCESS", runId, actionId });
  }

  handleApprovalRejected({ platformEvent, context } = {}) {
    const event = platformEvent;
    if (!event || typeof event !== "object") fail("platformEvent required.");
    const approvalId = String(event?.payload?.approvalId ?? "");
    if (!approvalId) fail("payload.approvalId required.");
    if (!this.approvalRuntime) fail("approvalRuntime required for handleApprovalRejected.");

    const nowISO = String(context?.nowISO ?? "2026-07-01T00:00:00.000Z");
    const approval = this.approvalRuntime.getRequestById(approvalId);
    if (!approval || String(approval.status) !== "REJECTED") {
      return deepFreeze({ status: "SKIPPED", message: "Approval not rejected." });
    }

    const runId = String(approval.sourceReference?.runId ?? "");
    const actionId = String(approval.sourceReference?.actionId ?? "");
    if (!runId || !actionId) fail("approval sourceReference must include runId and actionId.");

    const run = this.automationRuntime.getRunById(runId);
    if (!run) return deepFreeze({ status: "SKIPPED", message: "Run not found." });
    if (String(run.status) === AUTOMATION_RUN_STATUSES.COMPLETED || String(run.status) === AUTOMATION_RUN_STATUSES.CLOSED) {
      return deepFreeze({ status: "SKIPPED", message: "Run already closed." });
    }

    const plannedAction = (run.plannedActions ?? []).find((a) => String(a.id) === actionId);
    const executionResults = [...(run.executionResults ?? [])];
    const skipped = createAutomationActionExecutionResult({
      actionId,
      actionType: String(plannedAction?.actionType ?? "UNKNOWN"),
      status: ACTION_EXECUTION_STATUSES.SKIPPED,
      startedAt: nowISO,
      completedAt: nowISO,
      error: "Approval rejected.",
      metadata: { derivedFrom: { approvalId } },
    });

    const idx = executionResults.findIndex((r) => String(r?.actionId) === actionId);
    if (idx >= 0) executionResults[idx] = skipped;
    else executionResults.push(skipped);

    this.automationRuntime.applyEvent({
      id: `evt_auto_run_closed_${runId}_${nowISO}`,
      timestampISO: nowISO,
      type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_RUN_CLOSED,
      payload: {
        runId,
        executionResults,
        closedAt: nowISO,
        error: "Automation run closed after approval rejection.",
      },
    });

    return deepFreeze({ status: "CLOSED", runId, actionId });
  }

  _executePlannedActions({ runId, automationId, triggerEventId, plannedActions, nowISO, workRuntime } = {}) {
    const executionResults = [];
    const executables = toSortedByOrderThenId(plannedActions);

    for (const plannedAction of executables) {
      const outboundNeedsApproval = isOutboundAutomationAction(plannedAction);
      if (Boolean(plannedAction.requiresApproval) || outboundNeedsApproval) {
        const gatedAction = outboundNeedsApproval && !plannedAction.requiresApproval
          ? deepFreeze({ ...plannedAction, requiresApproval: true })
          : plannedAction;
        const gate = this._createApprovalGate({
          runId,
          automationId,
          triggerEventId,
          plannedAction: gatedAction,
          nowISO,
        });
        executionResults.push(gate.executionResult);

        this.automationRuntime.applyEvent({
          id: `evt_auto_run_waiting_${runId}_${nowISO}`,
          timestampISO: nowISO,
          type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_RUN_WAITING_FOR_APPROVAL,
          payload: { runId, executionResults },
        });

        return { waitingForApproval: true, failed: false };
      }

      const res = this.actionExecutorRegistry.execute({
        action: plannedAction,
        context: {
          nowISO,
          workRuntime,
          interactionRuntime: this.interactionRuntime,
          triggerEventId,
        },
      });
      executionResults.push(res);

      if (String(res.status) === ACTION_EXECUTION_STATUSES.FAILED) {
        this.automationRuntime.applyEvent({
          id: `evt_auto_run_failed_${runId}`,
          timestampISO: nowISO,
          type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_RUN_FAILED,
          payload: {
            runId,
            executionResults,
            failedAt: nowISO,
            error: res.error ?? "Automation run action failed.",
          },
        });
        this.automationPlatformEventPublisher?.publishAutomationRunFailed?.({
          runId,
          automationId,
          occurredAtISO: nowISO,
          triggerEventId,
        });
        return { waitingForApproval: false, failed: true };
      }
    }

    this.automationRuntime.applyEvent({
      id: `evt_auto_run_completed_${runId}`,
      timestampISO: nowISO,
      type: AUTOMATION_INTERNAL_EVENT_TYPES.AUTOMATION_RUN_COMPLETED,
      payload: { runId, executionResults, completedAt: nowISO },
    });
    this.automationPlatformEventPublisher?.publishAutomationRunCompleted?.({
      runId,
      automationId,
      occurredAtISO: nowISO,
      triggerEventId,
    });

    return { waitingForApproval: false, failed: false };
  }

  _createApprovalGate({ runId, automationId, triggerEventId, plannedAction, nowISO } = {}) {
    if (!this.approvalRuntime) fail("approvalRuntime required when action requiresApproval=true.");

    const actionId = String(plannedAction.id);
    const approvalId = deterministicApprovalId({ runId, actionId });
    const existing = this.approvalRuntime.getRequestById(approvalId);

    if (!existing) {
      this.approvalRuntime.applyEvent({
        id: `evt_approval_requested_${approvalId}_${nowISO}`,
        timestampISO: nowISO,
        type: APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_REQUESTED,
        payload: {
          request: createApprovalRequest({
            id: approvalId,
            requestType: "automation_action",
            source: "automation_os",
            sourceReference: deepFreeze({
              runId,
              actionId,
              automationId,
              triggerEventId,
            }),
            status: "PENDING",
            requestedAt: nowISO,
            requestedBy: "automation_engine",
            requiredApprover: String(plannedAction.parameters?.requiredApprover ?? "role:authorized_reviewer"),
            context: deepFreeze({
              actionType: String(plannedAction.actionType),
              actionId,
              runId,
              automationId,
            }),
            metadata: {},
          }),
        },
      });

      this.approvalPlatformEventPublisher?.publishApprovalRequested?.({
        approvalId,
        requestType: "automation_action",
        occurredAtISO: nowISO,
        metadata: { derivedFrom: { runId, actionId, automationId } },
      });
    }

    const executionResult = createAutomationActionExecutionResult({
      actionId,
      actionType: String(plannedAction.actionType),
      status: ACTION_EXECUTION_STATUSES.PENDING_APPROVAL,
      startedAt: nowISO,
      completedAt: null,
      output: deepFreeze({ approvalId }),
      metadata: deepFreeze({ derivedFrom: { runId, automationId } }),
    });

    return { approvalId, executionResult };
  }

  planActionsForAutomation({ automation, event, nowISO } = {}) {
    const orderedActions = toSortedByOrderThenId(automation.actions);
    const interactionId = String(event?.payload?.interactionId ?? "");
    const interaction =
      interactionId && this.interactionRuntime?.getInteraction
        ? this.interactionRuntime.getInteraction(interactionId)
        : null;

    return orderedActions.map((a) => {
      const resolvedParameters = resolveAutomationParameters({
        parameters: a.parameters ?? {},
        event,
        interaction,
      });

      return {
        id: String(a.id),
        actionType: String(a.actionType),
        requiresApproval: Boolean(a.requiresApproval),
        order: Number(a.order ?? 0),
        metadata: a.metadata ?? {},
        parameters: resolvedParameters,
      };
    });
  }
}
