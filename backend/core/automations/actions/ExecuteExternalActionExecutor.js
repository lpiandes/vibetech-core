import { AUTOMATION_ACTION_TYPES } from "../AutomationAction.js";
import { createAutomationActionExecutionResult } from "./AutomationActionExecutionResult.js";
import { createExternalActionRequest } from "../../integrations/actions/ExternalActionRequest.js";

export class ExecuteExternalActionExecutor {
  constructor({ actionOrchestrator, workspaceId, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    this.actionOrchestrator = actionOrchestrator;
    this.workspaceId = String(workspaceId ?? "");
    this.nowISO = String(nowISO);
    this.actionType = AUTOMATION_ACTION_TYPES.EXECUTE_EXTERNAL_ACTION;
  }

  validatePlan({ action } = {}) {
    const capability = action?.parameters?.capability;
    if (!capability) throw new Error("ExecuteExternalActionExecutor: parameters.capability required.");
  }

  async execute({ action, context } = {}) {
    this.validatePlan({ action });
    const approvalGranted = Boolean(context?.approvalGranted);
    const actionRequest = createExternalActionRequest({
      id: `auto_action_${action.id}`,
      workspaceId: this.workspaceId,
      capability: action.parameters.capability,
      connectionId: action.parameters.connectionId ?? null,
      providerId: action.parameters.providerId ?? null,
      requestedBy: context?.requestedBy ?? "automation",
      source: "automation",
      sourceReference: action.id,
      parameters: {
        ...(action.parameters.payload ?? {}),
        outboundApproved: approvalGranted || undefined,
      },
      requiresApproval: approvalGranted ? false : Boolean(action.requiresApproval),
      outboundApproved: approvalGranted,
      requestedAt: context?.nowISO ?? this.nowISO,
      idempotencyKey: `auto_${action.id}_${context?.runId ?? ""}`,
    });

    const result = await this.actionOrchestrator.execute(actionRequest);
    return createAutomationActionExecutionResult({
      actionId: action.id,
      actionType: this.actionType,
      status: result.status === "COMPLETED" ? "COMPLETED" : "FAILED",
      output: {
        externalReference: result.externalReference,
        actionStatus: result.status,
        error: result.error,
      },
      occurredAt: result.completedAt ?? this.nowISO,
    });
  }
}
