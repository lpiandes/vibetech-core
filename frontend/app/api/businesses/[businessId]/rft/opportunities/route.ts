import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  getRftOpportunityTrace,
  progressRftOpportunity,
  seedRftOpportunity,
  normalizeRftEvidence,
  RFT_PROVIDER_PROOF_KINDS,
} from "../../../../../../../backend/core/ai-builder/operating-contract/rft/index.js";
import { resolveAutonomyDisposition } from "../../../../../../../backend/core/company-rules/earnedAutonomy.js";

/**
 * POST — seed a test RFT opportunity or progress an existing one.
 * Body:
 *   { action: "seed", contact?, title?, triggerEvent?, evidence? }
 *   { action: "progress", cardId, toState?, eventType?, evidence?, outcomeType?, note? }
 *   { action: "trace", cardId }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json(
        { ok: false, error: "Business OS installation not found" },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "seed").trim();

    if (action === "trace") {
      const trace = getRftOpportunityTrace(installation, body.cardId);
      if (!trace) {
        return NextResponse.json({ ok: false, error: "Opportunity not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, trace });
    }

    if (action === "progress") {
      let toState = body.toState ?? null;
      const trace = getRftOpportunityTrace(installation, body.cardId);
      if (!trace) {
        return NextResponse.json({ ok: false, error: "Opportunity not found" }, { status: 404 });
      }
      const evidenceGate = validateProgressEvidence({
        incoming: body.evidence,
        existing: trace?.rft?.evidence,
      });
      if (!evidenceGate.ok) {
        return NextResponse.json(evidenceGate, { status: 400 });
      }
      const progressEvidence = Array.isArray(evidenceGate.evidence) ? evidenceGate.evidence : [];
      // Plan 11 — when leaving ActionProposed without an explicit toState, use earned autonomy.
      if (!toState && body.fromActionProposed !== false) {
        const current = String(trace?.rft?.state ?? "");
        if (current === "ActionProposed") {
          const disposition = resolveAutonomyDisposition({
            event: {
              kind: body.eventKind ?? "rft_opportunity",
              title: trace?.title ?? body.title ?? null,
              evidence: progressEvidence.length ? progressEvidence : (trace?.rft?.evidence ?? []),
              email: (ctx.user as any)?.email ?? installation?.configuration?.businessProfile?.ownerEmail ?? null,
            },
            installation,
            contract: (installation.configuration?.employees ?? []).find(
              (e: any) => e?.operatingContract?.rft,
            )?.operatingContract ?? null,
          });
          toState = disposition.proposedNextState;
        }
      }
      const result = await progressRftOpportunity({
        platformStore,
        installation,
        cardId: body.cardId,
        toState,
        eventType: body.eventType ?? null,
        evidence: progressEvidence,
        outcomeType: body.outcomeType ?? null,
        actorId: (ctx.user as any)?.id ?? "owner",
        note: body.note ?? null,
      });
      const status = result.ok ? 200 : (result.code === "card_not_found" ? 404 : 400);
      return NextResponse.json(result, { status });
    }

    const seedEvidence = validateSeedEvidence(body.evidence);
    if (!seedEvidence.ok) {
      return NextResponse.json(seedEvidence, { status: 400 });
    }
    const allowedSeedEvidence = Array.isArray(seedEvidence.evidence) ? seedEvidence.evidence : [];
    const seeded = await seedRftOpportunity({
      platformStore,
      installation,
      contact: body.contact && typeof body.contact === "object" ? body.contact : {},
      title: body.title ?? null,
      triggerEvent: body.triggerEvent ?? "WEBSITE_INQUIRY",
      evidence: allowedSeedEvidence,
      actorId: (ctx.user as any)?.id ?? "owner",
    });
    return NextResponse.json(seeded);
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

function normalizeEvidenceList(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => normalizeRftEvidence(entry))
    .filter(Boolean);
}

function evidenceKey(entry: { kind?: string; providerId?: string }) {
  return `${String(entry.kind ?? "")}:${String(entry.providerId ?? "")}`;
}

function validateProgressEvidence({
  incoming,
  existing,
}: {
  incoming: unknown;
  existing: unknown;
}) {
  const next = normalizeEvidenceList(incoming);
  if (!next.length) {
    return { ok: true, evidence: [] };
  }
  const prior = normalizeEvidenceList(existing);
  const allowed = new Set(prior.map(evidenceKey));
  const unmatched = next.filter((entry) => !allowed.has(evidenceKey(entry)));
  if (!unmatched.length) {
    return { ok: true, evidence: next };
  }
  const attemptedProviderProof = unmatched.some((entry) =>
    RFT_PROVIDER_PROOF_KINDS.includes(String(entry.kind ?? "")),
  );
  return {
    ok: false,
    code: attemptedProviderProof ? "client_provider_proof_forbidden" : "client_evidence_forbidden",
    message: attemptedProviderProof
      ? "Client progress calls cannot attach new provider proof. Use the server prove path."
      : "Client progress calls may only reference evidence already on the card.",
  };
}

function validateSeedEvidence(incoming: unknown) {
  const evidence = normalizeEvidenceList(incoming);
  const providerProof = evidence.find((entry) =>
    RFT_PROVIDER_PROOF_KINDS.includes(String(entry.kind ?? "")),
  );
  if (providerProof) {
    return {
      ok: false,
      code: "client_provider_proof_forbidden",
      message: "Client seed calls cannot inject provider proof. Use synced evidence or the server prove path.",
    };
  }
  return { ok: true, evidence };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json(
        { ok: false, error: "Business OS installation not found" },
        { status: 404 },
      );
    }
    const url = new URL(request.url);
    const cardId = url.searchParams.get("cardId");
    if (!cardId) {
      return NextResponse.json(
        { ok: false, error: "cardId query required" },
        { status: 400 },
      );
    }
    const trace = getRftOpportunityTrace(installation, cardId);
    if (!trace) {
      return NextResponse.json({ ok: false, error: "Opportunity not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, trace });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
