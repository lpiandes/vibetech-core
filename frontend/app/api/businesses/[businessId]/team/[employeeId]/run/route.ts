import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { compileCustomAiEmployee } from "../../../../../../../../backend/core/ai-builder/custom-ai/CustomAiWorkerCompiler.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; employeeId: string }> },
) {
  try {
    const { businessId, employeeId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const brief = String(body?.brief ?? "").trim();

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    let employees = Array.isArray(installation?.configuration?.employees)
      ? installation.configuration.employees
      : [];
    if (!employees.length && installation?.specificationId) {
      const spec = await platformStore.getBusinessOSSpecification({
        businessId,
        specificationId: installation.specificationId,
        specificationVersion: installation.specificationVersion ?? null,
      }).catch(() => null);
      employees = Array.isArray(spec?.specification?.employeeDefinitions) ? spec.specification.employeeDefinitions : [];
    }

    const found = employees.find(
      (entry: { employeeId?: string; id?: string }) =>
        String(entry.employeeId ?? entry.id) === String(employeeId),
    );
    const employee = compileCustomAiEmployee(
      found ?? {
        employeeId,
        label: String(body?.label ?? employeeId),
        purpose: String(body?.purpose ?? "Custom AI teammate"),
        ownerAdded: true,
      },
      { ownerAdded: true },
    );

    const result = await ctx.service.runCustomAiJob({
      employee: employee as Record<string, unknown>,
      brief,
      actorId: String((ctx as { authz?: { user?: { id?: string } } }).authz?.user?.id ?? "owner"),
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, ...result }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
