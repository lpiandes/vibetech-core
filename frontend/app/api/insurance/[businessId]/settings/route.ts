import { NextResponse } from "next/server";
import {
  requireFeRetentionContext,
  feJsonError,
  resolveFeSmsStatus,
} from "@/lib/insurance/feRetentionApi";
import { loadFeSmsCredential } from "../../../../../../backend/core/fe-retention/submitFeRetentionA2pRegistration.js";
import { describeSmsCarrierStatus } from "../../../../../../backend/core/integrations/sms/smsCarrierStatus.js";
import {
  applyFeTemplateOverrideToClients,
  listFeClients,
  updateFeSettings,
  writeFeRetentionState,
} from "@/lib/insurance/feRetentionCore";
import { readGmailInboxState, readGmailInboxSyncState } from "../../../../../../backend/core/integrations/gmail/GmailInboxStore.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await requireFeRetentionContext(businessId);
    const bookFrom = ctx.sms?.fromNumber
      || ctx.business?.packageConfiguration?.feRetentionBilling?.twilioFromNumber
      || null;
    const smsStatus = resolveFeSmsStatus({ fromNumber: bookFrom });
    const smsCred = await loadFeSmsCredential(ctx.platformStore, businessId);
    const a2pMeta = smsCred?.metadata && typeof smsCred.metadata === "object" ? smsCred.metadata : {};
    const carrier = describeSmsCarrierStatus(a2pMeta);
    let { state, installation } = ctx;

    const rawSettings = installation?.configuration?.feRetention?.settings ?? {};
    const needsHolidayMigrate =
      Number(rawSettings.holidayMonth ?? 12) === 12
      && Number(rawSettings.holidayDay) === 22
      && !rawSettings.holidayDateCustomized;

    if (needsHolidayMigrate) {
      state = {
        ...state,
        settings: {
          ...state.settings,
          holidayMonth: 12,
          holidayDay: 25,
          holidayDateCustomized: false,
        },
      };
      await writeFeRetentionState({
        platformStore: ctx.platformStore,
        installation,
        state,
        actorId: ctx.scope.user.id,
        historyAction: "fe_holiday_default_migrate",
      });
    }

    const inbox = readGmailInboxState(installation);
    const sync = readGmailInboxSyncState(installation);
    const gmailCreds = await ctx.platformStore.listIntegrationCredentialsForWorkspace?.(businessId).catch(() => []);
    const gmailConnected = (Array.isArray(gmailCreds) ? gmailCreds : []).some((row: any) => {
      const provider = String(row?.providerType ?? "");
      const id = String(row?.credentialId ?? "");
      return provider.includes("gmail") || id.includes("gmail");
    });

    return NextResponse.json({
      businessName: ctx.business.name,
      settings: state.settings,
      clients: listFeClients(state).map((c: any) => ({ id: c.id, name: c.name })),
      agentEmail: ctx.agentNotify?.email || state.settings?.agentNotifyEmail || ctx.scope.user.email || null,
      notifyEmail: ctx.agentNotify?.email || state.settings?.agentNotifyEmail || null,
      sms: {
        ...smsStatus,
        credentialAttached: Boolean(ctx.sms?.ok),
        fromNumber: ctx.sms?.fromNumber || smsStatus.fromNumber,
        a2pRegistrationStatus: a2pMeta.a2pRegistrationStatus ?? "pending",
        a2pMessage: a2pMeta.a2pMessage ?? null,
        a2pError: a2pMeta.a2pError ?? null,
        a2pLastCheckedAt: a2pMeta.a2pLastCheckedAt ?? null,
        carrierPhase: carrier.phase,
        carrierCopy: carrier.copy,
        deliveryLikely: carrier.deliveryLikely,
      },
      gmail: {
        connected: gmailConnected || Boolean(sync.lastSyncAt),
        lastSyncAt: sync.lastSyncAt ?? null,
        messageCount: Array.isArray(inbox.messages) ? inbox.messages.length : 0,
      },
    });
  } catch (err) {
    return feJsonError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await requireFeRetentionContext(businessId);
    const body = await request.json().catch(() => ({}));
    let state = updateFeSettings(ctx.state, body);
    if (body.applyTemplateToClients?.key && Array.isArray(body.applyTemplateToClients.clientIds)) {
      const applied = applyFeTemplateOverrideToClients(state, {
        kind: body.applyTemplateToClients.key,
        template: body.applyTemplateToClients.template
          ?? state.settings?.templates?.[body.applyTemplateToClients.key],
        clientIds: body.applyTemplateToClients.clientIds,
      });
      if (applied.ok) state = applied.state;
    }
    await writeFeRetentionState({
      platformStore: ctx.platformStore,
      installation: ctx.installation,
      state,
      actorId: ctx.scope.user.id,
      historyAction: "fe_settings_update",
    });
    return NextResponse.json({ ok: true, settings: state.settings });
  } catch (err) {
    return feJsonError(err);
  }
}
