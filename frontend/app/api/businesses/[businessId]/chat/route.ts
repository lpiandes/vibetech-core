import { NextResponse } from "next/server";

import { platformStore } from "@/lib/server/compose";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";
import { ensureCrmContactPersisted } from "../../../../../../backend/core/crm/ensureCrmContactAndOptionalCard.js";
import {
  buildChatReply,
  resolveChatContactSignals,
  readWebsiteChatThreads,
  appendChatTurns,
  persistWebsiteChatThreads,
} from "../../../../../../backend/core/integrations/chat/WebsiteChatService.js";

/**
 * Public native website chat — visitor message in, Knowledge-backed reply out.
 * Creates/updates a People contact when the visitor shares an email/name/phone
 * (typed directly or parsed from the message), and persists the transcript on
 * installation.configuration.websiteChatThreads.
 */

/** In-memory rate limit: businessId → timestamps (last minute). */
const RATE = new Map<string, number[]>();
const RATE_MAX = 40;
const RATE_WINDOW_MS = 60_000;

function rateLimited(businessId: string) {
  const now = Date.now();
  const prev = (RATE.get(businessId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX) {
    RATE.set(businessId, prev);
    return true;
  }
  prev.push(now);
  RATE.set(businessId, prev);
  return false;
}

function originAllowed(request: Request, installation: any) {
  const allowed = installation?.configuration?.chatAllowedOrigins
    ?? installation?.configuration?.formAllowedOrigins;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  const origin = request.headers.get("origin") || "";
  const referer = request.headers.get("referer") || "";
  const candidates = [origin, referer].filter(Boolean);
  if (!candidates.length) return true; // same-origin / curl
  return allowed.some((rule: string) => {
    const r = String(rule).trim().toLowerCase();
    if (!r) return false;
    return candidates.some((c) => String(c).toLowerCase().includes(r.replace(/^https?:\/\//, "")));
  });
}

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    if (rateLimited(businessId)) {
      return cors(NextResponse.json(
        { ok: false, error: "Too many messages — try again shortly." },
        { status: 429 },
      ));
    }

    const body = await request.json().catch(() => ({}));
    // Honeypot — bots fill "website"
    if (String(body.website ?? "").trim()) {
      return cors(NextResponse.json({ ok: true, discarded: true }));
    }

    const message = String(body.message ?? body.text ?? "").trim();
    const threadId = String(body.threadId ?? `thread_${Date.now().toString(36)}`).trim().slice(0, 80);
    const visitorName = String(body.name ?? body.visitorName ?? "").trim();
    const visitorEmail = String(body.email ?? body.visitorEmail ?? "").trim();
    const visitorPhone = String(body.phone ?? body.visitorPhone ?? "").trim();

    if (!message && !visitorEmail && !visitorName && !visitorPhone) {
      return cors(NextResponse.json({ ok: false, error: "message required" }, { status: 400 }));
    }

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return cors(NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 }));
    }

    if (!originAllowed(request, installation)) {
      return cors(NextResponse.json(
        { ok: false, error: "Origin not allowed for this chat widget." },
        { status: 403 },
      ));
    }

    const businessName = String(
      installation?.configuration?.businessName
        ?? installation?.plan?.businessName
        ?? "",
    ).trim();

    const knowledgeDocs = await platformStore
      .listKnowledgeDocumentsForBusiness(businessId)
      .catch(() => []);

    const at = new Date().toISOString();
    const reply = buildChatReply({
      message,
      documents: Array.isArray(knowledgeDocs) ? knowledgeDocs : [],
      businessId,
      businessName,
    });

    const existingThreads = readWebsiteChatThreads(installation);
    const existingThread = existingThreads.find((t) => String(t?.id) === threadId);
    let contactId: string | null = existingThread?.contactId ?? null;

    const signals = resolveChatContactSignals({ message, visitorName, visitorEmail, visitorPhone });
    let contactCreated = false;
    if (signals.email || signals.name || signals.phone) {
      let systemWorkspace: { service: any } | null = null;
      try {
        systemWorkspace = await getSystemWorkspaceForBusiness(businessId);
      } catch {
        systemWorkspace = null;
      }
      const nextContactId = contactId || `contact_chat_${Date.now().toString(36)}`;
      const ensured = await ensureCrmContactPersisted({
        platformStore,
        installation,
        actorId: "website_chat",
        contact: {
          id: nextContactId,
          partyId: nextContactId,
          name: signals.name || signals.email || signals.phone || "Website chat visitor",
          email: signals.email,
          phone: signals.phone,
          kind: "lead",
          tags: ["website_chat"],
          notes: message ? `From website chat: "${message.slice(0, 280)}"` : "Website chat visitor shared contact info",
        },
        addToPipeline: true,
        cardId: `card_chat_${nextContactId}`.slice(0, 64),
        cardTitle: signals.name || signals.email || "Website chat lead",
        dualWriteSource: "website_chat",
        workspaceService: systemWorkspace?.service ?? null,
      });
      contactId = ensured.contact?.id ?? nextContactId;
      contactCreated = true;

      try {
        const service = systemWorkspace?.service ?? (await getSystemWorkspaceForBusiness(businessId)).service;
        await service.emitSpecialtyBusinessEvent({
          eventType: "WEBSITE_CHAT_LEAD",
          brief: [
            "New website chat lead.",
            signals.name ? `Name: ${signals.name}` : null,
            signals.email ? `Email: ${signals.email}` : null,
            signals.phone ? `Phone: ${signals.phone}` : null,
            message ? `Message: ${message}` : null,
          ].filter(Boolean).join("\n"),
          forceManual: false,
          actorId: "website_chat",
          eventPayload: {
            contactId,
            cardId: ensured.cardId,
            threadId,
            name: signals.name,
            email: signals.email,
            phone: signals.phone,
            message,
            source: "website_native_chat",
            contact: ensured.contact,
          },
        });
      } catch {
        /* best-effort automation trigger */
      }
    }

    const turns = [
      { at, role: "visitor", text: message || "(shared contact info)" },
      {
        at,
        role: "assistant",
        text: reply.text,
        groundedInKnowledge: reply.groundedInKnowledge,
        citedDocumentIds: reply.citedDocumentIds,
      },
    ];
    const nextThreads = appendChatTurns({
      threads: existingThreads,
      threadId,
      turns,
      contactId,
      nowISO: at,
    });

    const fresh = await platformStore.getBusinessOSInstallation(businessId).catch(() => installation);
    await persistWebsiteChatThreads({
      platformStore,
      installation: fresh ?? installation,
      threads: nextThreads,
      actorId: "website_chat",
      nowISO: at,
    });

    return cors(NextResponse.json({
      ok: true,
      threadId,
      reply: reply.text,
      groundedInKnowledge: reply.groundedInKnowledge,
      citedDocumentIds: reply.citedDocumentIds,
      contactId,
      contactCreated,
      externalReference: `${threadId}:${at}`,
    }));
  } catch (err) {
    return cors(NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "chat_failed" },
      { status: 500 },
    ));
  }
}
