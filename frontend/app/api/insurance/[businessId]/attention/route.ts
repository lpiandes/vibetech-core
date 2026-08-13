import { NextResponse } from "next/server";
import {
  requireFeRetentionContext,
  feJsonError,
  getFeDeliveryProvider,
  resolveFeIntegrationPlatform,
} from "@/lib/insurance/feRetentionApi";
import {
  buildFeNeedsAttention,
  deliverFeClientTouchpoint,
  dismissUnmatchedCarrierNotice,
  feRetentionCatchUpDue,
  feScheduledSweepDue,
  runFeRetentionGmailLapsePass,
  runFeRetentionSchedulerForBusiness,
  writeFeRetentionState,
} from "@/lib/insurance/feRetentionCore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await requireFeRetentionContext(businessId);
    let { state, installation } = ctx;

    // Retry unsent work on every Today load (failed Twilio, missed cron, batch cap).
    // Also run the daily Gmail lapse pass once the 13:00 UTC window has opened.
    if (
      feRetentionCatchUpDue(state)
      || feScheduledSweepDue(state.settings?.lastSchedulerRunAt)
    ) {
      const integrationPlatform = await resolveFeIntegrationPlatform(businessId);
      const deliveryProvider = getFeDeliveryProvider();
      const deliverTouchpoint = (args: any) => deliverFeClientTouchpoint({
        ...args,
        deliveryProvider,
        businessName: ctx.business?.name,
        agentEmail: args.agentEmail || state.settings?.agentNotifyEmail,
        agentPhone: args.agentPhone || state.settings?.agentNotifyPhone,
      });
      const sched = await runFeRetentionSchedulerForBusiness({
        platformStore: ctx.platformStore,
        installation,
        integrationPlatform,
        deliverTouchpoint,
      });
      state = sched.state;
      installation.configuration = {
        ...(installation.configuration ?? {}),
        feRetention: state,
      };
      const gmail = await runFeRetentionGmailLapsePass({
        platformStore: ctx.platformStore,
        installation,
        integrationPlatform,
        deliverTouchpoint,
      });
      state = gmail.state;
    }

    const attention = buildFeNeedsAttention(state);
    return NextResponse.json({
      businessName: ctx.business.name,
      attention,
      settings: state.settings,
    });
  } catch (err) {
    return feJsonError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await requireFeRetentionContext(businessId);
    const body = await request.json().catch(() => ({}));
    if (body.dismissNoticeId) {
      const next = dismissUnmatchedCarrierNotice(ctx.state, body.dismissNoticeId);
      await writeFeRetentionState({
        platformStore: ctx.platformStore,
        installation: ctx.installation,
        state: next.state,
        actorId: ctx.scope.user.id,
        historyAction: "fe_notice_dismiss",
      });
      return NextResponse.json({ ok: true, attention: buildFeNeedsAttention(next.state) });
    }
    return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
  } catch (err) {
    return feJsonError(err);
  }
}
