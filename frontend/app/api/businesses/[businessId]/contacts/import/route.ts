import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { importLeadList } from "../../../../../../../backend/core/crm/importLeadList.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../../../../../../backend/core/persistence/RuntimeSnapshotKinds.js";
import { persistAffectedRuntimes } from "../../../../../../../backend/core/persistence/PersistedMutationCoordinator.js";

function graphFromCtx(ctx: any) {
  return ctx?.service?.connected?.ctx?.businessGraphRuntime
    ?? ctx?.service?.businessGraphRuntime
    ?? null;
}

function persistGraphFromCtx(ctx: any, businessId: string) {
  const stack = ctx?.service?.connected?.operatingStack
    ?? ctx?.service?.connected?.ctx
    ?? null;
  if (!stack?.businessGraphRuntime) return null;
  return async () => {
    await persistAffectedRuntimes({
      workspaceId: businessId,
      stack,
      integrationPlatform: ctx?.service?.connected?.integrationPlatform,
      kinds: [RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH],
    });
  };
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

    const contentType = String(request.headers.get("content-type") ?? "");
    let csvText = "";
    let pipelineId: string | null = null;
    let stageId: string | null = null;
    let addToPipeline = true;
    let kind = "lead";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") ?? form.get("csv");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const buf = Buffer.from(await (file as File).arrayBuffer());
        csvText = buf.toString("utf8");
      } else if (typeof file === "string") {
        csvText = file;
      }
      pipelineId = form.get("pipelineId") ? String(form.get("pipelineId")) : null;
      stageId = form.get("stageId") ? String(form.get("stageId")) : null;
      const addRaw = form.get("addToPipeline");
      if (addRaw != null) addToPipeline = String(addRaw) !== "false" && String(addRaw) !== "0";
      if (form.get("kind")) kind = String(form.get("kind"));
    } else {
      const body = await request.json().catch(() => ({}));
      csvText = String(body.csvText ?? body.csv ?? "");
      pipelineId = body.pipelineId ? String(body.pipelineId) : null;
      stageId = body.stageId ? String(body.stageId) : null;
      addToPipeline = body.addToPipeline !== false;
      kind = String(body.kind ?? "lead");
    }

    if (!csvText.trim()) {
      return NextResponse.json({ ok: false, error: "CSV file or csvText required" }, { status: 400 });
    }

    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    const report = await importLeadList({
      platformStore,
      installation,
      actorId,
      csvText,
      pipelineId,
      stageId,
      addToPipeline,
      kind,
      businessGraphRuntime: graphFromCtx(ctx),
      persistGraph: persistGraphFromCtx(ctx, businessId) ?? undefined,
    });

    if ((report.created ?? 0) > 0 || (report.updated ?? 0) > 0) {
      try {
        await (ctx.service as any).emitSpecialtyBusinessEvent?.({
          eventType: "CONTACT_IMPORTED",
          forceManual: false,
          brief: `Lead list import: ${report.created} created, ${report.updated} updated`,
          actorId,
          eventPayload: {
            created: report.created,
            updated: report.updated,
            contacts: report.contacts?.slice(0, 20) ?? [],
            source: "lead_list",
          },
        });
      } catch {
        /* optional */
      }
    }

    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
