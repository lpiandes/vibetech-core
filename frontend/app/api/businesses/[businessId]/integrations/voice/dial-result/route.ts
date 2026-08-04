import { NextResponse } from "next/server";

import { platformStore } from "@/lib/server/compose";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";
import {
  buildMissedCallNoticeTwiml,
  handleMissedCallFollowUp,
  isMissedDialStatus,
  resolveMissedCallFollowUpConfig,
} from "../../../../../../../../backend/core/integrations/voice/missedCallSmsFollowUp.js";

function twimlResponse(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/**
 * Twilio <Dial action> callback after ringing the forward number.
 * On no-answer/busy/failed → CRM party + SMS follow-up.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const form = await request.formData().catch(() => null);
  const dialStatus = String(
    form?.get("DialCallStatus")
    ?? form?.get("CallStatus")
    ?? form?.get("DialStatus")
    ?? "",
  ).trim();
  const from = String(form?.get("From") ?? form?.get("Caller") ?? "").trim();
  const callSid = String(form?.get("CallSid") ?? form?.get("ParentCallSid") ?? "").trim();

  if (!isMissedDialStatus(dialStatus)) {
    return twimlResponse(buildMissedCallNoticeTwiml({
      sayText: "Thanks for calling. Goodbye.",
    }));
  }

  try {
    const { service, installation } = await getSystemWorkspaceForBusiness(businessId);
    const stack = (service as any)?.connected?.operatingStack ?? null;
    const config = resolveMissedCallFollowUpConfig({ businessId, workspace: service });
    const businessName = String(
      installation?.configuration?.businessProfile?.businessName
      ?? installation?.configuration?.businessName
      ?? "our team",
    );

    if (stack && from && callSid) {
      await handleMissedCallFollowUp({
        stack,
        workspace: service,
        businessId,
        fromPhone: from,
        callSid,
        disposition: dialStatus,
        businessName,
        smsBodyTemplate: config.smsBodyTemplate,
        platformStore,
        installation,
        persist: true,
      });
    }
  } catch {
    /* still acknowledge the caller */
  }

  return twimlResponse(buildMissedCallNoticeTwiml({
    sayText: "We missed your call. We'll text you shortly.",
  }));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  return POST(request, { params });
}
