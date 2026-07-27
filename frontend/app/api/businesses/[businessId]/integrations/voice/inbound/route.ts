import { NextResponse } from "next/server";

import { platformStore } from "@/lib/server/compose";
import {
  buildReceptionistGatherTwiml,
  buildReceptionistHangupTwiml,
  runVoiceReceptionistTurn,
} from "../../../../../../../../backend/core/integrations/voice/voiceReceptionist.js";
import { enqueueVoiceAppointmentWork } from "../../../../../../../../backend/core/integrations/voice/enqueueVoiceAppointmentWork.js";
import { enqueueVoiceCalendarHold } from "../../../../../../../../backend/core/integrations/voice/enqueueVoiceCalendarHold.js";
import {
  readCrmState,
  writeCrmState,
  upsertContact,
} from "../../../../../../../../backend/core/crm/CrmStore.js";
import { businessKnowledgeService } from "@/lib/server/compose";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";

async function loadWorkspaceService(businessId: string) {
  const { service } = await getSystemWorkspaceForBusiness(businessId);
  return service;
}

function twimlResponse(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function actionUrl(request: Request, businessId: string) {
  const origin = new URL(request.url).origin;
  return `${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/voice/inbound`;
}

/**
 * Twilio inbound voice webhook — AI receptionist Gather loop.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const form = await request.formData().catch(() => null);
  const speech = String(form?.get("SpeechResult") ?? form?.get("UnstableSpeechResult") ?? "").trim();
  const from = String(form?.get("From") ?? "").trim();
  const callSid = String(form?.get("CallSid") ?? "").trim();

  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  const businessName = String(
    installation?.configuration?.businessProfile?.businessName
    ?? installation?.configuration?.businessName
    ?? "our business",
  );

  if (!speech) {
    return twimlResponse(buildReceptionistGatherTwiml({
      sayText: `Thanks for calling ${businessName}. How can I help you today?`,
      actionUrl: actionUrl(request, businessId),
    }));
  }

  let knowledgeSnippets: any[] = [];
  try {
    const docs = await businessKnowledgeService.listOperationalDocuments(businessId);
    knowledgeSnippets = (Array.isArray(docs) ? docs : []).slice(0, 5).map((d: any) => ({
      title: d.title,
      text: String(d.summary ?? d.excerpt ?? d.content ?? d.title ?? "").slice(0, 500),
    }));
  } catch {
    knowledgeSnippets = [];
  }

  let turn = await runVoiceReceptionistTurn({
    speech,
    businessName,
    knowledgeSnippets,
  });

  if (installation && (turn.intent === "message" || turn.intent === "book" || from)) {
    try {
      let crm = readCrmState(installation);
      const contactId = `contact_voice_${(from || callSid || Date.now()).replace(/\W/g, "").slice(-16)}`;
      crm = upsertContact(crm, {
        id: contactId,
        partyId: contactId,
        name: from || "Phone caller",
        phone: from,
        kind: "lead",
        tags: ["voice_call", turn.intent],
        notes: [
          `Inbound call ${callSid || ""}`.trim(),
          `Caller said: ${speech}`,
          `Receptionist intent: ${turn.intent}`,
          `Reply: ${turn.reply}`,
        ].join("\n"),
      });
      await writeCrmState({
        platformStore,
        installation,
        crm,
        actorId: "voice_receptionist",
      });
    } catch {
      /* best effort */
    }
  }

  if (turn.intent === "book") {
    try {
      const [workResult, calendarHold] = await Promise.all([
        enqueueVoiceAppointmentWork({
          businessId,
          speech,
          from,
          callSid,
          reply: turn.reply,
          getWorkspace: loadWorkspaceService,
        }),
        enqueueVoiceCalendarHold({
          businessId,
          speech,
          from,
          callSid,
          getWorkspace: loadWorkspaceService,
        }),
      ]);
      if (calendarHold?.ok) {
        turn = {
          ...turn,
          reply: `${String(turn.reply ?? "").trim()} I also placed a calendar hold for the team to confirm with you.`,
        };
      }
    } catch {
      /* best effort */
    }
  }

  if (turn.intent === "goodbye") {
    return twimlResponse(buildReceptionistHangupTwiml({ sayText: turn.reply }));
  }

  return twimlResponse(buildReceptionistGatherTwiml({
    sayText: `${turn.reply} Anything else I can help with?`,
    actionUrl: actionUrl(request, businessId),
  }));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  return POST(request, { params });
}
