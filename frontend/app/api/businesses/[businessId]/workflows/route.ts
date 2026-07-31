import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  readWorkflowState,
  writeWorkflowState,
  upsertWorkflow,
  removeWorkflow,
  createBlankWorkflow,
  triggerCatalog,
  actionCatalog,
  conditionFieldCatalog,
  conditionOpCatalog,
} from "../../../../../../backend/core/workflows/WorkflowAutomationStore.js";
import { runSingleWorkflow, runWorkflowsForEvent } from "../../../../../../backend/core/workflows/WorkflowAutomationRunner.js";
import { proposeWorkflowAutomationWithLlm } from "../../../../../../backend/core/workflows/proposeWorkflowAutomationWithLlm.js";
import { readCrmState } from "../../../../../../backend/core/crm/CrmStore.js";
import { checkAiAskQuota } from "../../../../../../backend/core/ai-builder/AiAskQuotaService.js";
import { llmIsLiveAvailable } from "../../../../../../backend/core/providers/createLlmProvider.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const state = readWorkflowState(installation);
    const crm = readCrmState(installation);
    return NextResponse.json({
      ok: true,
      workflows: state.workflows,
      catalogs: {
        triggers: triggerCatalog(),
        actions: actionCatalog(),
        conditionFields: conditionFieldCatalog(),
        conditionOps: conditionOpCatalog(),
      },
      pipelines: (crm.pipelines ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        stages: (p.stages ?? []).map((s: any) => ({ id: s.id, label: s.label })),
      })),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    let state = readWorkflowState(installation);

    if (body.action === "create") {
      const blank = createBlankWorkflow({
        name: body.name || "New automation",
        triggerType: body.triggerType || "form_submit",
      });
      state = upsertWorkflow(state, blank);
      await writeWorkflowState({ platformStore, installation, workflowsState: state, actorId });
      return NextResponse.json({ ok: true, workflow: blank, workflows: state.workflows });
    }

    if (body.action === "save" || body.action === "upsert") {
      if (!body.workflow) {
        return NextResponse.json({ ok: false, error: "workflow required" }, { status: 400 });
      }
      state = upsertWorkflow(state, body.workflow);
      await writeWorkflowState({ platformStore, installation, workflowsState: state, actorId });
      const saved = state.workflows.find((w: any) => w.id === body.workflow.id) || state.workflows.at(-1);
      return NextResponse.json({ ok: true, workflow: saved, workflows: state.workflows });
    }

    if (body.action === "delete") {
      state = removeWorkflow(state, body.workflowId || body.id);
      await writeWorkflowState({ platformStore, installation, workflowsState: state, actorId });
      return NextResponse.json({ ok: true, workflows: state.workflows });
    }

    if (body.action === "set_status") {
      const id = String(body.workflowId || body.id || "");
      const wf = state.workflows.find((w: any) => String(w.id) === id);
      if (!wf) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      state = upsertWorkflow(state, { ...wf, status: body.status === "live" ? "live" : "off" });
      await writeWorkflowState({ platformStore, installation, workflowsState: state, actorId });
      return NextResponse.json({ ok: true, workflows: state.workflows });
    }

    if (body.action === "test_run") {
      const id = String(body.workflowId || body.id || "");
      const wf = state.workflows.find((w: any) => String(w.id) === id);
      if (!wf) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      const source = String(body.source || body.payload?.source || "manual_test").trim() || "manual_test";
      const contact = body.contact || body.payload?.contact || {
        name: source === "meta" ? "Meta Test Lead" : source === "form" ? "Form Test Lead" : "Test Lead",
        email: "test@example.com",
        phone: "+15555550100",
        kind: "lead",
        tags: ["test", source],
      };
      const result = await runSingleWorkflow({
        workflow: { ...wf, status: "live" },
        payload: body.payload || {
          eventType: wf.trigger?.eventType || (source === "meta" ? "META_LEAD" : source === "form" ? "FORM_SUBMIT" : "MANUAL_RUN"),
          contact,
          source,
          testWorkflow: true,
        },
        env: {
          platformStore,
          installation,
          actorId,
          workRuntime: (ctx.service as any)?.workRuntime ?? null,
        },
      });
      const log = Array.isArray(result?.log) ? result.log : [];
      return NextResponse.json({
        ok: true,
        result: {
          ...result,
          log: log.length
            ? log
            : [
                { type: "trigger", passed: true, detail: `Synthetic ${source} payload injected` },
                { type: "complete", ok: result?.ok !== false, detail: "Workflow finished" },
              ],
          artifacts: {
            peopleHref: `/b/${encodeURIComponent(businessId)}/crm/contacts`,
            needsAttentionHref: `/b/${encodeURIComponent(businessId)}/needs-attention`,
          },
        },
      });
    }

    if (body.action === "fire_event") {
      const result = await runWorkflowsForEvent({
        platformStore,
        installation,
        eventType: String(body.eventType || "MANUAL_RUN"),
        payload: body.payload || {},
        actorId,
        workRuntime: (ctx.service as any)?.workRuntime ?? null,
      });
      return NextResponse.json({ ok: true, result });
    }

    if (body.action === "propose" || body.action === "propose_apply") {
      const instruction = String(body.instruction ?? "").trim();
      if (!instruction) {
        return NextResponse.json({ ok: false, error: "instruction required" }, { status: 400 });
      }
      const apply = body.action === "propose_apply" || Boolean(body.apply);
      const crm = readCrmState(installation);
      const pipelines = (crm.pipelines ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        stages: (p.stages ?? []).map((s: any) => ({ id: s.id, label: s.label })),
      }));

      let current = null as any;
      const workflowId = String(body.workflowId || body.id || body.workflow?.id || "").trim();
      if (workflowId) {
        current = state.workflows.find((w: any) => String(w.id) === workflowId) || null;
      } else if (body.workflow) {
        current = body.workflow;
      }

      let quota = null as Awaited<ReturnType<typeof checkAiAskQuota>> | null;
      if (llmIsLiveAvailable()) {
        quota = await checkAiAskQuota({
          scope: "automation",
          businessId,
          employeeId: `workflow_${current?.id || "new"}`,
          platformStore,
          consume: true,
        });
        if (!quota.allowed) {
          return NextResponse.json({
            ok: false,
            reason: "quota_exceeded",
            quota,
            error: quota.message,
          }, { status: 429 });
        }
      }

      const proposal = await proposeWorkflowAutomationWithLlm({
        instruction,
        currentWorkflow: current,
        pipelines,
        workflows: state.workflows.filter((w: any) => !current || String(w.id) !== String(current.id)),
      });
      if (!proposal.ok) {
        return NextResponse.json({ ok: false, ...proposal, quota }, { status: 400 });
      }

      if (!apply) {
        return NextResponse.json({ ok: true, proposal, applied: false, quota });
      }

      state = upsertWorkflow(state, proposal.proposedWorkflow);
      await writeWorkflowState({ platformStore, installation, workflowsState: state, actorId });
      const saved = state.workflows.find((w: any) => String(w.id) === String(proposal.proposedWorkflow.id));
      return NextResponse.json({
        ok: true,
        applied: true,
        proposal,
        workflow: saved,
        workflows: state.workflows,
        quota,
      });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
