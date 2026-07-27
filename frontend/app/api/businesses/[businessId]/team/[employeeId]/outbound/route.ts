import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  sendSpecialtyOutbound,
  sendSpecialtyPathOutbound,
  suggestSpecialtyMessageTemplate,
} from "../../../../../../../../backend/core/ai-builder/specialty/specialtyOutbound.js";
import { applyOperatingContractPatch, presentOperatingContract } from "../../../../../../../../backend/core/ai-builder/operating-contract/buildOperatingContract.js";
import { resolveOperatingIndustry } from "../../../../../../../../backend/core/ai-builder/mapPackAiRolesToSelectedEmployees.js";

/**
 * GET ?suggest=1 — suggest message template
 * POST — approve & send work outbound OR save message template on contract
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string; employeeId: string }> },
) {
  try {
    const { businessId, employeeId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const url = new URL(request.url);
    if (url.searchParams.get("suggest") !== "1") {
      return NextResponse.json({ ok: false, error: "Use ?suggest=1" }, { status: 400 });
    }
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const employees = Array.isArray(installation?.configuration?.employees)
      ? installation.configuration.employees
      : [];
    const employee = employees.find(
      (e: { employeeId?: string; id?: string }) => String(e.employeeId ?? e.id) === String(employeeId),
    ) ?? { employeeId, label: employeeId };
    const businessName = String(
      installation?.configuration?.businessProfile?.businessName ?? "Club",
    );
    return NextResponse.json({
      ok: true,
      messageTemplate: suggestSpecialtyMessageTemplate({ employee, businessName }),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; employeeId: string }> },
) {
  try {
    const { businessId, employeeId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "save_template");

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const employees = Array.isArray(installation.configuration?.employees)
      ? [...installation.configuration.employees]
      : [];
    const index = employees.findIndex(
      (e: { employeeId?: string; id?: string }) => String(e.employeeId ?? e.id) === String(employeeId),
    );
    const employee = index >= 0 ? employees[index] : { employeeId, label: employeeId };
    const industry = resolveOperatingIndustry({
      industry: installation?.configuration?.businessProfile?.industry,
      businessName: installation?.configuration?.businessProfile?.businessName,
      operatingPackId: installation?.configuration?.operatingPackId,
      configuration: installation?.configuration,
    });
    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");

    if (action === "save_template" || action === "suggest_and_save") {
      let template = body.messageTemplate;
      if (action === "suggest_and_save" || body.suggest) {
        template = suggestSpecialtyMessageTemplate({
          employee,
          businessName: installation?.configuration?.businessProfile?.businessName,
        });
      }
      const result = applyOperatingContractPatch({
        employee,
        industry,
        patch: { messageTemplate: template ?? {} },
        actorId,
        nowISO: new Date().toISOString(),
      });
      const nextEmployee = {
        ...employee,
        employeeId: String(employee.employeeId ?? employeeId),
        operatingContract: result.contract,
      };
      if (index >= 0) employees[index] = nextEmployee;
      else employees.push(nextEmployee);

      await platformStore.upsertBusinessOSInstallation({
        id: installation.id ?? installation.installationId ?? `install_${businessId}`,
        businessId,
        specificationRowId: installation.specificationRowId ?? null,
        specificationId: installation.specificationId,
        specificationVersion: installation.specificationVersion ?? 1,
        specificationContentHash: installation.specificationContentHash
          ?? installation.contentHash
          ?? "message_template",
        planId: installation.planId ?? `plan_${businessId}`,
        status: installation.status ?? "installed",
        plan: installation.plan ?? {},
        actionCheckpoints: installation.actionCheckpoints ?? [],
        configuration: { ...(installation.configuration ?? {}), employees },
        history: [
          ...(Array.isArray(installation.history) ? installation.history : []),
          { at: new Date().toISOString(), action: "update_message_template", employeeId, actorId },
        ],
        actorUserId: installation.actorUserId ?? actorId,
        installedAt: installation.installedAt ?? null,
      });

      return NextResponse.json({
        ok: true,
        messageTemplate: result.contract.messageTemplate,
        presentation: presentOperatingContract(result.contract, result.schema),
      });
    }

    if (action === "approve_and_send") {
      const workItemId = String(body.workItemId ?? "").trim();
      if (!workItemId) {
        return NextResponse.json({ ok: false, error: "workItemId required" }, { status: 400 });
      }
      const workItem = ctx.service.workRuntime?.getWorkItem?.(workItemId);
      if (!workItem) {
        return NextResponse.json({ ok: false, error: "Work not found" }, { status: 404 });
      }

      const approvalId = String(body.approvalId ?? "").trim();
      const approvalRuntime = (ctx.service as any)?.connected?.ctx?.approvalRuntime
        ?? (ctx.service as any)?.approvalRuntime
        ?? null;
      let outboundApproved = false;
      if (approvalId && approvalRuntime?.getRequestById) {
        const req = approvalRuntime.getRequestById(approvalId);
        const status = String(req?.status ?? "").toUpperCase();
        const refWork = String(
          req?.sourceReference?.workItemId
          ?? req?.context?.workItemId
          ?? "",
        );
        outboundApproved = status === "GRANTED"
          && (!refWork || refWork === workItemId);
      }
      if (!outboundApproved) {
        // Owner is explicitly approving in this request — record GRANT then send.
        if (approvalId && approvalRuntime && typeof ctx.service.applyOwnerApprovalDecision === "function") {
          try {
            ctx.service.applyOwnerApprovalDecision(approvalId, "GRANT");
            outboundApproved = true;
          } catch (err) {
            return NextResponse.json({
              ok: false,
              error: err instanceof Error ? err.message : "Could not grant approval",
              reason: "approval_grant_failed",
            }, { status: 400 });
          }
        }
      }
      if (!outboundApproved) {
        return NextResponse.json({
          ok: false,
          error: "Owner GRANT required before send. Approve from Needs Attention first, or pass approvalId.",
          reason: "outbound_approval_required",
        }, { status: 403 });
      }

      const template = employee?.operatingContract?.messageTemplate ?? {};
      const recipients = Array.isArray(body.recipients) ? body.recipients : [];
      const recipientsByAudience = body.recipientsByAudience && typeof body.recipientsByAudience === "object"
        ? body.recipientsByAudience
        : {
          scope_who: recipients,
          team: recipients,
          submitter: recipients,
        };

      // Prefer multi-step path sends when the contract has an automation path.
      if (employee?.operatingContract?.automationPath?.steps?.length) {
        const pathResult = await sendSpecialtyPathOutbound({
          businessId,
          employee,
          workItem,
          recipientsByAudience,
          outboundApproved: true,
          integrationHub: (ctx.service as any).connected?.integrationPlatform?.hub
            ?? (ctx.service as any).connected?.integrationHub
            ?? null,
        });
        if (!pathResult.ok) {
          return NextResponse.json({ ok: false, ...pathResult }, { status: 400 });
        }
        return NextResponse.json({ ok: true, result: pathResult });
      }

      const channels = Array.isArray(body.channels) && body.channels.length
        ? body.channels.map(String)
        : (Array.isArray(template.channels) && template.channels.length
          ? template.channels.map(String)
          : ["email"]);

      const sendResult = await sendSpecialtyOutbound({
        businessId,
        workItem,
        channels,
        recipients,
        emailSubject: String(body.emailSubject ?? template.emailSubject ?? ""),
        emailBody: String(body.emailBody ?? template.emailBody ?? workItem?.metadata?.artifact?.body ?? ""),
        smsBody: String(body.smsBody ?? template.smsBody ?? ""),
        outboundApproved: true,
        integrationHub: (ctx.service as any).connected?.integrationPlatform?.hub
          ?? (ctx.service as any).connected?.integrationHub
          ?? null,
      });

      if (!sendResult.ok) {
        return NextResponse.json({ ok: false, ...sendResult }, { status: 400 });
      }
      return NextResponse.json({ ok: true, result: sendResult });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
