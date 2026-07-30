import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  ROLE_ACCESS_MODULE_CATALOG,
  readRoleAccessMatrix,
  writeRoleAccessForMembershipRole,
} from "../../../../../../../backend/core/business-os/BusinessOSRoleAccessConfig.js";

async function loadSpecification(businessId: string, installation: any) {
  if (!installation?.specificationId) return null;
  try {
    const specRow = await platformStore.getBusinessOSSpecification({
      businessId,
      specificationId: installation.specificationId,
      specificationVersion: installation.specificationVersion ?? null,
    });
    return specRow?.specification ?? null;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const specification = await loadSpecification(businessId, installation);
    const matrix = readRoleAccessMatrix(installation, specification);
    return NextResponse.json({ ok: true, modules: ROLE_ACCESS_MODULE_CATALOG, roles: matrix });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const body = await request.json().catch(() => ({}));
    const membershipRole = String(body?.membershipRole ?? "").trim();
    const visibleModuleIds = Array.isArray(body?.visibleModuleIds) ? body.visibleModuleIds : [];
    if (!membershipRole) {
      return NextResponse.json({ ok: false, error: "membershipRole required" }, { status: 400 });
    }

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    const specification = await loadSpecification(businessId, installation);
    const actorId = String((ctx as any).authz?.user?.id ?? (ctx as any).user?.id ?? "owner");

    await writeRoleAccessForMembershipRole({
      platformStore,
      installation,
      specification,
      membershipRole,
      visibleModuleIds,
      actorId,
    });

    const refreshed = await platformStore.getBusinessOSInstallation(businessId).catch(() => installation);
    const matrix = readRoleAccessMatrix(refreshed, specification);
    return NextResponse.json({ ok: true, modules: ROLE_ACCESS_MODULE_CATALOG, roles: matrix });
  } catch (error) {
    if (error instanceof Error && /not editable/.test(error.message)) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return authorizationErrorResponse(error);
  }
}
