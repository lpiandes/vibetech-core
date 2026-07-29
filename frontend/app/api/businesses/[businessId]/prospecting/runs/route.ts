import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import {
  createProspectingRun,
  readProspectingState,
  upsertProspectingRun,
  writeProspectingState,
} from "../../../../../../../backend/core/prospecting/ProspectingJobStore.js";
import {
  assertAiProspectingPurchased,
  assertProspectingQuota,
  resolveProspectingCaps,
} from "../../../../../../../backend/core/prospecting/prospectingGate.js";
import { runProspectingJob } from "../../../../../../../backend/core/prospecting/runProspectingJob.js";
import { businessHasAiProspecting, readPurchasedPackagesFromConfig } from "../../../../../../../backend/core/platform/packages/SalesPackageCatalog.js";

function loadSecrets(vault: any, businessId: string, credentialId: string) {
  try {
    const cred = vault?.get?.(credentialId);
    return cred?.secrets && typeof cred.secrets === "object" ? cred.secrets : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const packages = readPurchasedPackagesFromConfig(installation?.configuration ?? {});
    const entitled = businessHasAiProspecting(packages);
    if (!entitled) {
      return NextResponse.json({
        ok: true,
        entitled: false,
        runs: [],
        caps: { maxRunsPerDay: 0, maxLeadsPerRun: 0 },
      });
    }
    assertAiProspectingPurchased(installation);
    const state = readProspectingState(installation);
    const caps = resolveProspectingCaps(installation);
    return NextResponse.json({
      ok: true,
      entitled: true,
      runs: state.runs ?? [],
      caps,
    });
  } catch (error: any) {
    if (error?.status === 403) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 403 });
    }
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
    const body = await request.json().catch(() => ({}));
    let installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }

    try {
      assertAiProspectingPurchased(installation);
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code ?? "PACKAGE_REQUIRED" },
        { status: error.status ?? 403 },
      );
    }

    let quota;
    try {
      quota = assertProspectingQuota(installation);
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code ?? "QUOTA_EXCEEDED" },
        { status: error.status ?? 429 },
      );
    }

    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    const run = createProspectingRun({
      criteria: {
        industry: body.industry,
        geo: body.geo ?? body.location,
        companySizeBand: body.companySizeBand ?? body.sizeBand,
        keywords: body.keywords,
        titles: body.titles,
        maxLeads: body.maxLeads ?? body.limit,
        pipelineId: body.pipelineId,
        stageId: body.stageId,
      },
      actorId,
      maxLeadsCap: quota.caps.maxLeadsPerRun,
    });

    if (!run.criteria.industry && !(run.criteria.keywords?.length)) {
      return NextResponse.json(
        { ok: false, error: "industry or keywords required" },
        { status: 400 },
      );
    }

    let state = readProspectingState(installation);
    state = upsertProspectingRun(state, run);
    await writeProspectingState({ platformStore, installation, prospectingState: state, actorId });
    installation = await platformStore.getBusinessOSInstallation(businessId) ?? installation;

    const vault =
      (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();
    const secrets = loadSecrets(vault, businessId, `cred_social_screening_${businessId}`)
      ?? loadSecrets(vault, businessId, `cred_prospecting_${businessId}`);
    const enrichmentSecrets = loadSecrets(vault, businessId, `cred_prospecting_enrichment_${businessId}`);

    // Run inline for v1 (small max leads). Could move to job queue later.
    const result = await runProspectingJob({
      platformStore,
      installation,
      runId: run.id,
      actorId,
      secrets,
      enrichmentSecrets,
    });

    return NextResponse.json({
      ok: result.ok,
      run: result.run,
      error: result.error ?? null,
      caps: quota.caps,
    }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
