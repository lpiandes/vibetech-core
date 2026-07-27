import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { evaluateOutboundSendPermission } from "../../approvals/OutboundApprovalGate.js";
import { resolveMessagePersonalization } from "./resolveMessagePersonalization.js";

/**
 * Send specialty Work outbound (email and/or SMS) after owner GRANT.
 * Uses integration hub adapters when available; never sends without outboundApproved.
 */
export async function sendSpecialtyOutbound({
  businessId,
  workItem,
  channels = ["email"],
  recipients = [],
  emailSubject = "",
  emailBody = "",
  smsBody = "",
  outboundApproved = false,
  integrationHub = null,
  sendEmail = null,
  sendSms = null,
} = {}) {
  const permission = evaluateOutboundSendPermission({
    channel: channels.includes("sms") ? "sms" : "email",
    outboundApproved,
  });
  if (!permission.allowed) {
    return deepFreeze({
      ok: false,
      reason: permission.reason ?? "outbound_approval_required",
      note: "Owner GRANT required before any customer send.",
    });
  }

  const toList = (Array.isArray(recipients) ? recipients : [])
    .map((r) => (typeof r === "string" ? { address: r } : r))
    .filter((r) => r?.address || r?.email || r?.phone);

  if (!toList.length) {
    return deepFreeze({
      ok: false,
      reason: "no_recipients",
      note: "Add People contacts (email/phone) before sending.",
    });
  }

  const results = [];
  const personalizationSource = {
    eventPayload: workItem?.metadata?.eventPayload ?? workItem?.metadata?.personalization ?? {},
    contact: workItem?.metadata?.contact ?? null,
    ...(workItem?.metadata?.personalization ?? {}),
  };
  const subject = resolveMessagePersonalization(
    String(emailSubject || workItem?.metadata?.messageTemplate?.emailSubject
      || workItem?.title || "Update from your club").trim(),
    personalizationSource,
  );
  const body = resolveMessagePersonalization(
    String(emailBody || workItem?.metadata?.messageTemplate?.emailBody
      || workItem?.metadata?.artifact?.body || workItem?.description || "").trim(),
    personalizationSource,
  );
  const sms = resolveMessagePersonalization(
    String(smsBody || workItem?.metadata?.messageTemplate?.smsBody || "").trim()
      || body.slice(0, 320),
    personalizationSource,
  );

  for (const channel of channels.map(String)) {
    if (channel === "email") {
      for (const recipient of toList.filter((r) => r.address || r.email)) {
        const to = String(recipient.address ?? recipient.email);
        if (typeof sendEmail === "function") {
          const sent = await sendEmail({ to, subject, body, businessId, outboundApproved: true });
          results.push({ channel: "email", to, ok: Boolean(sent?.ok ?? true), detail: sent });
        } else if (integrationHub?.executeAction) {
          const sent = await integrationHub.executeAction({
            connectionType: "business_email",
            capability: "SEND_EMAIL",
            input: { to, subject, body, outboundApproved: true },
          });
          results.push({ channel: "email", to, ok: Boolean(sent?.ok ?? sent?.status === "SUCCESS"), detail: sent });
        } else {
          results.push({ channel: "email", to, ok: false, reason: "email_provider_unavailable" });
        }
      }
    }
    if (channel === "sms") {
      for (const recipient of toList.filter((r) => r.phone || r.sms)) {
        const to = String(recipient.phone ?? recipient.sms);
        if (typeof sendSms === "function") {
          const sent = await sendSms({ to, body: sms, businessId, outboundApproved: true });
          results.push({ channel: "sms", to, ok: Boolean(sent?.ok ?? true), detail: sent });
        } else if (integrationHub?.executeAction) {
          const sent = await integrationHub.executeAction({
            connectionType: "sms_channel",
            capability: "SEND_SMS",
            input: { to, body: sms, outboundApproved: true },
          });
          results.push({ channel: "sms", to, ok: Boolean(sent?.ok ?? sent?.status === "SUCCESS"), detail: sent });
        } else {
          results.push({ channel: "sms", to, ok: false, reason: "sms_provider_unavailable" });
        }
      }
    }
    if (channel === "voice" || channel === "call") {
      for (const recipient of toList.filter((r) => r.phone || r.sms)) {
        const to = String(recipient.phone ?? recipient.sms);
        if (integrationHub?.executeAction) {
          const sent = await integrationHub.executeAction({
            connectionType: "voice_channel",
            capability: "PLACE_VOICE_CALL",
            input: { to, outboundApproved: true },
          });
          results.push({ channel: "voice", to, ok: Boolean(sent?.ok ?? sent?.status === "SUCCESS"), detail: sent });
        } else {
          results.push({ channel: "voice", to, ok: false, reason: "voice_provider_unavailable" });
        }
      }
    }
  }

  const anyOk = results.some((r) => r.ok);
  return deepFreeze({
    ok: anyOk,
    reason: anyOk ? null : (results[0]?.reason ?? "send_failed"),
    results,
    workItemId: workItem?.id ?? null,
  });
}

/**
 * Suggest a starter message template from operating contract scope (deterministic, no LLM required).
 */
export function suggestSpecialtyMessageTemplate({ employee = {}, businessName = "" } = {}) {
  const contract = employee?.operatingContract ?? {};
  const answers = contract?.scope?.answers ?? {};
  const who = answerText(answers.audience) || "families";
  const when = answerText(answers.when) || "this week";
  const rules = answerText(answers.constraints) || "Keep it short and clear.";
  const club = String(businessName || "our club").trim();
  const label = String(employee.label ?? "Communications");

  const emailSubject = `${club}: update for ${who}`;
  const emailBody = [
    `Hi families,`,
    ``,
    `Quick update from ${club} regarding ${who}.`,
    ``,
    `Timing: ${when}`,
    ``,
    `Please reply if you have questions.`,
    ``,
    `— ${label}`,
    ``,
    `(Tone/rules: ${rules})`,
  ].join("\n");
  const smsBody = `${club}: update for ${who} — ${when}. Reply with questions.`;

  const where = answerText(answers.where).toLowerCase();
  const channels = [];
  if (/email|e-mail/.test(where) || !where) channels.push("email");
  if (/sms|text/.test(where)) channels.push("sms");
  if (!channels.length) channels.push("email");

  return deepFreeze({
    emailSubject,
    emailBody,
    smsBody,
    channels,
  });
}

/**
 * Execute enabled outbound steps on an automation path (each step has its own content).
 * Still requires outboundApproved for customer-facing sends.
 */
export async function sendSpecialtyPathOutbound({
  businessId,
  employee = {},
  workItem = null,
  recipientsByAudience = {},
  outboundApproved = false,
  integrationHub = null,
  sendEmail = null,
  sendSms = null,
  eventPayload = null,
} = {}) {
  const path = employee?.operatingContract?.automationPath;
  const steps = Array.isArray(path?.steps)
    ? path.steps.filter((s) => s && s.enabled !== false)
    : [];
  const outboundSteps = steps.filter((s) =>
    ["send_email", "send_sms", "notify_team"].includes(String(s.type)),
  );

  if (!outboundSteps.length) {
    return deepFreeze({
      ok: false,
      reason: "no_outbound_steps",
      note: "Add Send email / Send SMS steps to the automation path.",
    });
  }

  const personalizationWork = workItem?.metadata?.eventPayload || eventPayload
    ? {
      ...workItem,
      metadata: {
        ...(workItem?.metadata ?? {}),
        eventPayload: workItem?.metadata?.eventPayload ?? eventPayload,
        personalization: workItem?.metadata?.personalization ?? eventPayload,
      },
    }
    : workItem;

  const results = [];
  for (const step of outboundSteps) {
    const type = String(step.type);
    const direction = String(step.direction ?? (type === "notify_team" ? "internal" : "external"));
    const channels = resolveStepChannels(step);
    const audience = String(
      step.audience
      ?? (direction === "internal" || type === "notify_team" ? "team" : "scope_who"),
    );
    const recipients = resolveAudienceRecipients({
      audience,
      customRecipients: step.customRecipients,
      people: step.people,
      recipientsByAudience,
    });
    const approved = direction === "internal" || type === "notify_team"
      ? true
      : outboundApproved;

    if (channels.includes("email")) {
      const stepResult = await sendSpecialtyOutbound({
        businessId,
        workItem: personalizationWork,
        channels: ["email"],
        recipients,
        emailSubject: step.subject || workItem?.title || "Update",
        emailBody: step.body || workItem?.metadata?.artifact?.body || "",
        outboundApproved: approved,
        integrationHub,
        sendEmail,
        sendSms,
      });
      results.push({
        stepId: step.id,
        type,
        direction,
        channel: "email",
        label: step.label,
        ...stepResult,
      });
    }
    if (channels.includes("sms")) {
      const stepResult = await sendSpecialtyOutbound({
        businessId,
        workItem: personalizationWork,
        channels: ["sms"],
        recipients,
        smsBody: step.body || "",
        outboundApproved: approved,
        integrationHub,
        sendEmail,
        sendSms,
      });
      results.push({
        stepId: step.id,
        type,
        direction,
        channel: "sms",
        label: step.label,
        ...stepResult,
      });
    }
  }

  const anyOk = results.some((r) => r.ok);
  return deepFreeze({
    ok: anyOk,
    reason: anyOk ? null : results.find((r) => !r.ok)?.reason ?? "send_failed",
    results,
  });
}

function resolveStepChannels(step = {}) {
  if (Array.isArray(step.channels) && step.channels.length) {
    return [...new Set(step.channels.map(String).filter((c) => c === "email" || c === "sms"))];
  }
  const type = String(step.type ?? "");
  const channel = String(step.channel ?? "");
  if (channel.includes("sms") && channel.includes("email")) return ["email", "sms"];
  if (type === "send_sms" || channel.includes("sms")) return ["sms"];
  return ["email"];
}

function resolveAudienceRecipients({
  audience,
  customRecipients = "",
  people = null,
  recipientsByAudience = {},
} = {}) {
  if (audience === "custom") {
    if (Array.isArray(people) && people.length) {
      return people
        .map((person) => ({
          name: String(person?.name ?? "").trim() || undefined,
          address: String(person?.email ?? "").trim() || undefined,
          email: String(person?.email ?? "").trim() || undefined,
          phone: String(person?.phone ?? "").trim() || undefined,
        }))
        .filter((person) => person.email || person.phone);
    }
    return String(customRecipients ?? "")
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((address) => ({
        address: address.includes("@") ? address : undefined,
        email: address.includes("@") ? address : undefined,
        phone: address.includes("@") ? undefined : address,
      }));
  }
  const listed = recipientsByAudience[audience];
  if (Array.isArray(listed) && listed.length) return listed;
  return [];
}

function answerText(raw) {
  if (raw == null) return "";
  if (typeof raw === "object") {
    if (raw.notApplicable) return "";
    return String(raw.value ?? "").trim();
  }
  return String(raw).trim();
}
