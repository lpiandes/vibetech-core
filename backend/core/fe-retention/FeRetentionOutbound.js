/**
 * FE Retention outbound orchestration — client SMS + agent email/SMS on lapse.
 * Skips client SMS when the client has replied STOP (smsOptedOut).
 */
import { buildFeMessageBodies } from "./FeRetentionTemplates.js";
import {
  appendFeMessageLog,
  isFeClientSmsPaused,
  markClientTouchSent,
  writeFeRetentionState,
} from "./FeRetentionStore.js";
import { sendFeRetentionSmsMessage, resolveFeRetentionFromNumber } from "./FeRetentionSms.js";
import { sendFeAgentNotifyEmail } from "./FeRetentionEmail.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function buildFeAgentAlertSms({ client, businessName = "your book" } = {}) {
  const name = safeString(client?.name) || "A client";
  const status = safeString(client?.policy?.status) || "missed";
  const phone = safeString(client?.phone) || "no phone";
  const book = safeString(businessName) || "FE Retention";
  return `VibeTech alert (${book}): ${name} is ${status}. Client phone: ${phone}. Open Insurance → Needs attention.`;
}

/**
 * Build + send a typed retention touchpoint; persist message log.
 */
export async function deliverFeClientTouchpoint({
  platformStore,
  installation,
  state,
  client,
  kind,
  integrationPlatform = null,
  deliveryProvider = null,
  emailSender = null,
  agentEmail = null,
  agentPhone = null,
  businessName = null,
  actorId = "fe_retention",
} = {}) {
  const body = buildFeMessageBodies({ kind, client, settings: state.settings });
  let nextState = state;
  let smsResult = { ok: false, reason: "skipped" };
  const bookName = businessName || installation?.configuration?.businessName || "FE Retention";
  const fromNumber = await resolveFeRetentionFromNumber({
    platformStore,
    businessId: installation?.businessId,
    packageConfiguration: installation?.configuration,
  });

  if (isFeClientSmsPaused(client)) {
    const logged = appendFeMessageLog(nextState, {
      kind,
      channel: "sms",
      clientId: client?.id,
      clientName: client?.name,
      to: client?.phone || null,
      body,
      ok: false,
      error: "sms_opted_out",
    });
    nextState = logged.state;
    smsResult = { ok: false, reason: "sms_opted_out" };
  } else if (client?.phone) {
    smsResult = await sendFeRetentionSmsMessage({
      integrationPlatform,
      platformStore,
      businessId: installation?.businessId,
      packageConfiguration: installation?.configuration,
      fromNumber: fromNumber || null,
      to: client.phone,
      body,
    });
    const logged = appendFeMessageLog(nextState, {
      kind,
      channel: "sms",
      clientId: client.id,
      clientName: client.name,
      to: client.phone,
      body,
      ok: smsResult.ok,
      error: smsResult.ok ? null : (smsResult.message || smsResult.reason),
      externalReference: smsResult.externalReference,
    });
    nextState = logged.state;
  } else {
    const logged = appendFeMessageLog(nextState, {
      kind,
      channel: "sms",
      clientId: client?.id,
      clientName: client?.name,
      to: null,
      body,
      ok: false,
      error: "no_phone",
    });
    nextState = logged.state;
  }

  if (kind === "welcome" && smsResult.ok) {
    nextState = markClientTouchSent(nextState, { clientId: client.id, field: "welcome" });
  }
  if (kind === "docsMail" && smsResult.ok) {
    nextState = markClientTouchSent(nextState, { clientId: client.id, field: "docsMail" });
  }

  if (kind === "lapseRecovery" || kind === "missedPaymentNotice") {
    const notifyEmail = safeString(agentEmail || state.settings?.agentNotifyEmail);
    const notifyPhone = safeString(agentPhone || state.settings?.agentNotifyPhone);

    if (notifyEmail) {
      let emailResult;
      if (typeof emailSender === "function") {
        try {
          await emailSender({
            to: notifyEmail,
            subject: `Policy attention: ${client?.name || "client"} — ${client?.policy?.status || "missed"}`,
            text: `Client ${client?.name} status ${client?.policy?.status}. Recovery SMS ${smsResult.ok ? "sent" : "failed"}${smsResult.reason === "sms_opted_out" ? " (client opted out of SMS)" : ""}.`,
          });
          emailResult = { ok: true };
        } catch (err) {
          emailResult = { ok: false, message: err instanceof Error ? err.message : String(err) };
        }
      } else {
        emailResult = await sendFeAgentNotifyEmail({
          deliveryProvider,
          to: notifyEmail,
          client,
          businessName: bookName,
        });
      }
      const logged = appendFeMessageLog(nextState, {
        kind: "agent_missed_payment_email",
        channel: "email",
        clientId: client?.id,
        clientName: client?.name,
        to: notifyEmail,
        body: `Missed/lapsed notice for ${client?.name}`,
        ok: Boolean(emailResult?.ok),
        error: emailResult?.ok ? null : (emailResult?.message || emailResult?.reason),
      });
      nextState = logged.state;
    }

    if (notifyPhone) {
      const agentBody = buildFeAgentAlertSms({ client, businessName: bookName });
      const agentSms = await sendFeRetentionSmsMessage({
        integrationPlatform,
        platformStore,
        businessId: installation?.businessId,
        packageConfiguration: installation?.configuration,
        fromNumber: fromNumber || null,
        to: notifyPhone,
        body: agentBody,
      });
      const logged = appendFeMessageLog(nextState, {
        kind: "agent_missed_payment_sms",
        channel: "sms",
        clientId: client?.id,
        clientName: client?.name,
        to: notifyPhone,
        body: agentBody,
        ok: Boolean(agentSms?.ok),
        error: agentSms?.ok ? null : (agentSms?.message || agentSms?.reason),
        externalReference: agentSms?.externalReference ?? null,
      });
      nextState = logged.state;
    }
  }

  if (platformStore && installation) {
    nextState = await writeFeRetentionState({
      platformStore,
      installation,
      state: nextState,
      actorId,
      historyAction: `fe_touch_${kind}`,
      settingsMode: "preserve_settings",
    });
    installation.configuration = {
      ...(installation.configuration ?? {}),
      feRetention: nextState,
    };
  }

  return { ok: smsResult.ok, smsResult, state: nextState };
}
