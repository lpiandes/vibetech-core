import { AutomationOrchestrationService } from "../automations/AutomationOrchestrationService.js";
import { AutomationRuleEngine } from "../automations/engine/AutomationRuleEngine.js";
import { APPROVAL_INTERNAL_EVENT_TYPES } from "./ApprovalEventTypes.js";

/**
 * Bounded owner approval decision — mutates ApprovalRuntime and resumes automation.
 */
export function processOwnerApprovalDecision({
  approvalRuntime,
  automationRuntime,
  workRuntime,
  interactionRuntime,
  actionExecutorRegistry,
  automationPlatformEventPublisher,
  approvalPlatformEventPublisher,
  approvalId,
  decision,
  nowISO,
} = {}) {
  const id = String(approvalId ?? "");
  const req = approvalRuntime?.getRequestById?.(id);
  if (!req) throw new Error(`processOwnerApprovalDecision: approval not found: ${id}`);
  if (req.status !== "PENDING") throw new Error(`processOwnerApprovalDecision: approval not pending: ${id}`);

  const effectiveNowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  const granted = String(decision).toUpperCase() === "GRANT" || String(decision).toUpperCase() === "APPROVE";

  approvalRuntime.applyEvent({
    id: `evt_owner_decision_${id}_${effectiveNowISO}`,
    timestampISO: effectiveNowISO,
    type: granted ? APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_GRANTED : APPROVAL_INTERNAL_EVENT_TYPES.APPROVAL_REJECTED,
    source: "owner_approval_decision",
    payload: { approvalId: id, decidedAt: effectiveNowISO },
  });

  if (granted && automationRuntime && actionExecutorRegistry) {
    const orchestration = new AutomationOrchestrationService({
      automationRuntime,
      automationRuleEngine: new AutomationRuleEngine(),
      actionExecutorRegistry,
      interactionRuntime,
      automationPlatformEventPublisher,
      approvalRuntime,
      approvalPlatformEventPublisher,
    });
    orchestration.resumeAfterApproval({
      platformEvent: { payload: { approvalId: id } },
      context: { nowISO: effectiveNowISO, workRuntime },
    });
  }

  return {
    approvalId: id,
    status: granted ? "GRANTED" : "REJECTED",
    decidedAt: effectiveNowISO,
  };
}

export function createOperationalBoundary(stack, { nowISO } = {}) {
  if (!stack) return null;
  return {
    processOwnerApprovalDecision({ approvalId, decision }) {
      return processOwnerApprovalDecision({
        approvalRuntime: stack.approvalRuntime,
        automationRuntime: stack.automationRuntime,
        workRuntime: stack.workRuntime,
        interactionRuntime: stack.interactionRuntime,
        actionExecutorRegistry: stack.actionExecutorRegistry,
        automationPlatformEventPublisher: stack.automationPlatformEventPublisher,
        approvalPlatformEventPublisher: stack.approvalPlatformEventPublisher,
        approvalId,
        decision,
        nowISO: nowISO ?? stack.nowISO,
      });
    },
  };
}
