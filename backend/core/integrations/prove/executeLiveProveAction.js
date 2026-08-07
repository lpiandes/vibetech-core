/**
 * Execute a live integration prove action against real providers when credentials exist.
 * Voice prove places a live call when TwiML URL is available; otherwise credential verify.
 * Outbound still requires owner approval gate upstream.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getSharedCredentialVault } from "../credentials/CredentialVault.js";
import { hydrateWorkspaceCredentials } from "../credentials/durableCredentialVault.js";
import { createVaultCredentialResolver } from "../credentials/createVaultCredentialResolver.js";
import { GmailIntegrationAdapter } from "../adapters/GmailIntegrationAdapter.js";
import { GoogleCalendarIntegrationAdapter } from "../adapters/GoogleCalendarIntegrationAdapter.js";
import { TwilioSmsIntegrationAdapter } from "../adapters/TwilioSmsIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { PROVE_ACTIONS } from "./IntegrationProveService.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

/**
 * place_test_call proves Twilio dial-out. Conversational claim requires:
 * - owner listen-and-confirm
 * - Knowledge present so the greeting path can cite (knowledgeCitedAttempted)
 * Without Knowledge, dial-out still succeeds but conversationalComplete stays false.
 */
function buildPlaceTestCallMetadata(knowledgeCount, extras = {}) {
  const hasKnowledge = Number(knowledgeCount) > 0;
  return {
    conversationalProve: true,
    requiresOwnerConfirm: true,
    conversationalComplete: false,
    knowledgeCitedAttempted: hasKnowledge,
    knowledgeRequiredForConversationalClaim: true,
    knowledgeAvailable: hasKnowledge,
    ...(hasKnowledge ? {} : { conversationalBlocker: "knowledge_empty" }),
    ...extras,
  };
}

const ACTION_TO_CONNECTION = Object.freeze({
  [PROVE_ACTIONS.send_test_email]: "business_email",
  [PROVE_ACTIONS.create_test_event]: "calendar",
  [PROVE_ACTIONS.send_test_sms]: "sms_channel",
  [PROVE_ACTIONS.place_test_call]: "voice_channel",
  [PROVE_ACTIONS.ingest_test_lead]: "meta_lead_ads",
  [PROVE_ACTIONS.run_sports_golden_path]: "business_email",
  [PROVE_ACTIONS.run_dental_golden_path]: "business_email",
  [PROVE_ACTIONS.prove_appointment_setter_sms]: "sms_channel",
  [PROVE_ACTIONS.submit_test_form]: "website_forms",
  [PROVE_ACTIONS.sync_test_crm_contact]: "hubspot",
  [PROVE_ACTIONS.book_test_slot]: "calendar",
});

/**
 * @param {{
 *   action: string,
 *   businessId: string,
 *   platformStore: any,
 *   proveEmail?: string|null,
 *   provePhone?: string|null,
 *   allowSimulated?: boolean,
 *   knowledgeCount?: number|null,
 * }} input
 */
export async function executeLiveProveAction({
  action,
  businessId,
  platformStore,
  proveEmail = process.env.PROVE_TEST_EMAIL ?? null,
  provePhone = process.env.PROVE_TEST_PHONE ?? null,
  allowSimulated = process.env.PROVE_ALLOW_SIMULATED === "1",
  vault = null,
  knowledgeCount = null,
} = {}) {
  const act = String(action ?? "");

  if (act === PROVE_ACTIONS.submit_test_form) {
    const { readCrmState, writeCrmState, upsertContact, upsertPipelineCard } = await import(
      "../../crm/CrmStore.js"
    );
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return deepFreeze({
        ok: false,
        reason: "business_missing",
        message: "Business installation not found.",
      });
    }
    const contactId = `contact_form_prove_${Date.now().toString(36)}`;
    const leadEmail = String(proveEmail || "prove-form@example.com");
    const leadPhone = String(provePhone || "");
    let crm = readCrmState(installation);
    crm = upsertContact(crm, {
      id: contactId,
      partyId: contactId,
      name: "Prove Form Lead",
      email: leadEmail,
      phone: leadPhone,
      kind: "lead",
      tags: ["website_form", "prove"],
      notes: "VIBETech website form prove submission",
    });
    const pipe = (crm.pipelines ?? [])[0] ?? null;
    let cardId = null;
    if (pipe?.stages?.[0]?.id) {
      const upserted = upsertPipelineCard(crm, {
        pipelineId: pipe.id,
        card: {
          id: `card_form_${contactId}`.slice(0, 64),
          title: "Prove Form Lead",
          stageId: pipe.stages[0].id,
          contactId,
          value: 0,
        },
      });
      crm = upserted.crm;
      cardId = upserted.cardId;
    }
    await writeCrmState({
      platformStore,
      installation,
      crm,
      actorId: "website_form_prove",
    });

    const formSubmissionId = `form_prove_${contactId}`;
    const followUpDraft = {
      id: `draft_form_prove_${contactId}`,
      channel: "email",
      status: "pending_approval",
      subject: "Thanks — we received your inquiry",
      bodyPreview: "Thanks for reaching out. We received your website inquiry and will follow up with next steps shortly.",
      contactId,
      cardId,
      recipientEmail: leadEmail,
      audience: "prove_form_lead",
      createdAt: new Date().toISOString(),
      source: "website_form_prove",
    };

    try {
      const fresh = await platformStore.getBusinessOSInstallation(businessId).catch(() => installation);
      const drafts = Array.isArray(fresh?.configuration?.pendingDecisionDrafts)
        ? fresh.configuration.pendingDecisionDrafts.filter((d) => d?.id !== followUpDraft.id)
        : [];
      drafts.push(followUpDraft);
      await platformStore.upsertBusinessOSInstallation({
        id: fresh.id ?? fresh.installationId ?? `install_${businessId}`,
        businessId,
        specificationRowId: fresh.specificationRowId ?? null,
        specificationId: fresh.specificationId ?? `spec_${businessId}`,
        specificationVersion: fresh.specificationVersion ?? 1,
        specificationContentHash: fresh.specificationContentHash ?? fresh.contentHash ?? "form_prove",
        planId: fresh.planId ?? `plan_${businessId}`,
        status: fresh.status ?? "installed",
        plan: fresh.plan ?? {},
        actionCheckpoints: Array.isArray(fresh.actionCheckpoints) ? fresh.actionCheckpoints : [],
        configuration: {
          ...(fresh.configuration ?? {}),
          pendingDecisionDrafts: drafts.slice(-25),
        },
        history: Array.isArray(fresh.history) ? fresh.history.slice(-50) : [],
        installedAt: fresh.installedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: "website_form_prove",
      });
    } catch {
      /* draft persist best-effort — still return draft on prove result */
    }

    return deepFreeze({
      ok: true,
      simulated: false,
      verified: true,
      provider: "website_forms",
      contactId,
      cardId,
      followUpDraft,
      detail: {
        formSubmissionId,
        externalReference: formSubmissionId,
        providerKind: "form_submission_id",
        at: new Date().toISOString(),
        note: "Controlled website-form prove — contact + pending follow-up draft for Decisions.",
        followUpDraft,
        pendingApproval: true,
      },
      message: "Form intake recorded with People contact and a pending follow-up draft for Decisions.",
    });
  }

  if (act === PROVE_ACTIONS.prove_team_availability) {
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return deepFreeze({
        ok: false,
        reason: "business_missing",
        message: "Business installation not found.",
      });
    }
    const { readTeamAvailability, listBookableMembers } = await import(
      "../appointment-setter/TeamAvailabilityStore.js"
    );
    const availability = readTeamAvailability(installation);
    const bookable = listBookableMembers(availability).filter(
      (member) => Array.isArray(member.weekly) && member.weekly.length > 0,
    );
    if (!bookable.length) {
      return deepFreeze({
        ok: false,
        reason: "no_bookable_members",
        message: "Add at least one teammate with weekly availability windows (Team → Availability) before proving auto-book.",
      });
    }
    return deepFreeze({
      ok: true,
      simulated: false,
      provider: "team_availability",
      bookableMemberCount: bookable.length,
      message: `${bookable.length} teammate${bookable.length === 1 ? "" : "s"} bookable with weekly availability — the appointment setter can auto-book confirmed slots.`,
    });
  }

  if (act === PROVE_ACTIONS.sync_test_crm_contact) {
    const credentialVault = vault ?? getSharedCredentialVault();
    await hydrateWorkspaceCredentials({ platformStore, vault: credentialVault, workspaceId: businessId });
    const credentials = await platformStore.listIntegrationCredentialsForWorkspace(businessId);
    const hubspot = credentials.find((c) => /hubspot/i.test(String(c.providerType ?? c.credentialId ?? "")));
    const highlevel = credentials.find((c) => /highlevel/i.test(String(c.providerType ?? c.credentialId ?? "")));
    const matching = hubspot || highlevel;
    if (!matching) {
      return deepFreeze({
        ok: false,
        reason: "not_connected",
        message: "Connect HubSpot or HighLevel before running CRM prove.",
      });
    }
    const record = typeof credentialVault?.get === "function"
      ? credentialVault.get(matching.credentialId)
      : null;
    const secrets = record?.secrets ?? {};
    const accessToken = String(secrets.accessToken ?? secrets.apiKey ?? "").trim();
    const locationId = secrets.locationId
      ? String(secrets.locationId)
      : (matching.metadata?.locationId ? String(matching.metadata.locationId) : null);
    const provider = hubspot ? "hubspot" : "highlevel";
    const { createCrmProveContact } = await import("../crm/CrmPrivateAppConnect.js");
    const created = await createCrmProveContact({
      provider,
      accessToken,
      locationId,
      email: proveEmail,
    });
    if (!created.ok) return deepFreeze(created);
    return deepFreeze({
      ...created,
      detail: {
        externalReference: created.providerId,
        providerId: created.providerId,
        providerKind: created.evidenceKind,
        at: created.at,
      },
    });
  }

  const credentialVault = vault ?? getSharedCredentialVault();
  await hydrateWorkspaceCredentials({ platformStore, vault: credentialVault, workspaceId: businessId });
  const credentialResolver = createVaultCredentialResolver({ vault: credentialVault });
  const credentials = await platformStore.listIntegrationCredentialsForWorkspace(businessId);
  const connectionId = ACTION_TO_CONNECTION[act] ?? null;
  const matching = credentials.find((c) => matchesConnection(c, connectionId, act));

  if (!matching) {
    if (allowSimulated) {
      return deepFreeze({
        ok: true,
        simulated: true,
        reason: "simulated_no_credentials",
        message: "No vault credentials — simulated prove (PROVE_ALLOW_SIMULATED=1).",
      });
    }
    return deepFreeze({
      ok: false,
      reason: "credentials_missing",
      message: "Connect and store provider credentials before proving.",
    });
  }

  const connection = {
    id: connectionId,
    status: "CONNECTED",
    credentialReference: {
      credentialId: matching.credentialId,
      providerType: matching.providerType,
      metadata: matching.metadata ?? {},
    },
  };

  try {
    if (act === PROVE_ACTIONS.send_test_email) {
      const to = String(proveEmail || matching.metadata?.senderEmail || "").trim();
      if (!to) {
        return deepFreeze({
          ok: false,
          reason: "prove_email_required",
          message: "Enter an email address to receive the prove test.",
        });
      }
      const fromEmail = String(
        matching.secrets?.senderEmail
        ?? matching.metadata?.senderEmail
        ?? matching.senderEmail
        ?? "",
      ).trim();
      const adapter = new GmailIntegrationAdapter({ nowISO: new Date().toISOString() });
      const result = await adapter.executeAction({
        actionRequest: {
          capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
          parameters: {
            message: {
              id: `prove_${Date.now()}`,
              channel: "email",
              subject: "VIBETech prove test",
              // GmailMessageMapper expects `body` (not bodyText).
              body: "This is a VIBETech design-partner prove test. Safe to ignore.",
              recipients: [{ id: "prove", type: "external", metadata: { email: to } }],
              sender: {
                id: "business",
                type: "system",
                ...(fromEmail ? { metadata: { email: fromEmail } } : {}),
              },
            },
          },
        },
        connection,
        credentialResolver,
      });
      const mapped = mapAdapterResult(result, { provider: "gmail", to });
      if (mapped?.ok !== false && businessId) {
        try {
          const { recordUsageSafe } = await import("../../platform/billing/UsageMetering.js");
          recordUsageSafe({
            businessId,
            meterId: "emails",
            quantity: 1,
            platformStore,
          });
        } catch {
          /* non-blocking */
        }
      }
      return mapped;
    }

    if (act === PROVE_ACTIONS.create_test_event) {
      const start = new Date(Date.now() + 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const adapter = new GoogleCalendarIntegrationAdapter({ nowISO: new Date().toISOString() });
      const result = await adapter.executeAction({
        actionRequest: {
          capability: INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT,
          parameters: {
            summary: "VIBETech prove test",
            description: "Design-partner calendar prove — safe to delete.",
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
          },
        },
        connection,
        credentialResolver,
      });
      const mapped = mapAdapterResult(result, { provider: "google_calendar" });
      if (mapped?.ok !== false && businessId) {
        try {
          const { publishSpecialtyPlatformEvent } = await import(
            "../../ai-builder/specialty/fireSpecialtyTrigger.js"
          );
          publishSpecialtyPlatformEvent({
            businessId,
            employeeId: "calendar",
            eventType: "SCHEDULE_CHANGE",
            payload: { source: "google_calendar_prove", eventId: result?.externalReference ?? null },
            nowISO: new Date().toISOString(),
          });
        } catch {
          /* best effort */
        }
      }
      return mapped;
    }

    if (act === PROVE_ACTIONS.send_test_sms) {
      const normalizedTo = normalizeProvePhone(provePhone);
      if (!normalizedTo) {
        return deepFreeze({
          ok: false,
          reason: "prove_phone_required",
          message: "Enter a phone number (with country code) to receive the test text.",
        });
      }
      if (!/^\+[1-9]\d{7,14}$/.test(normalizedTo)) {
        return deepFreeze({
          ok: false,
          reason: "prove_phone_invalid",
          message: "Use a real mobile number with country code, e.g. +15551234567.",
        });
      }
      const adapter = new TwilioSmsIntegrationAdapter({ nowISO: new Date().toISOString() });
      const result = await adapter.executeAction({
        actionRequest: {
          capability: INTEGRATION_CAPABILITIES.SEND_SMS,
          parameters: {
            to: normalizedTo,
            body: "VIBETech prove test — safe to ignore.",
          },
        },
        connection,
        credentialResolver,
      });
      if (result?.status !== "completed" || !result?.externalReference) {
        const twilioMsg = String(result?.error ?? "");
        return deepFreeze({
          ok: false,
          reason: result?.error ?? "prove_failed",
          message: /unverified|21608|trial/i.test(twilioMsg)
            ? "Twilio trial can only text Verified Caller IDs. In Twilio Console → Phone Numbers → Manage → Verified Caller IDs, add your phone, then retry."
            : (twilioMsg || "Twilio did not accept the test text."),
          provider: "twilio_sms",
          to: normalizedTo,
          detail: result,
        });
      }

      // Twilio often returns 201/queued before carriers reject (trial/A2P). Confirm status.
      const delivery = await adapter.checkMessageStatus({
        connection,
        credentialResolver,
        messageSid: result.externalReference,
      });
      if (!delivery.ok) {
        return deepFreeze({
          ok: false,
          reason: delivery.reason ?? "sms_not_delivered",
          message: delivery.message
            ?? "Twilio accepted the send but the text did not deliver. For trial accounts, verify your phone in Twilio Console → Phone Numbers → Verified Caller IDs.",
          provider: "twilio_sms",
          to: normalizedTo,
          externalReference: result.externalReference,
          delivery,
        });
      }

      return deepFreeze({
        ok: true,
        simulated: false,
        provider: "twilio_sms",
        to: normalizedTo,
        externalReference: result.externalReference,
        deliveryStatus: delivery.status,
        metadata: result.metadata ?? {},
      });
    }

    if (act === PROVE_ACTIONS.prove_appointment_setter_sms) {
      const creds = credentialResolver.resolve(connection.credentialReference);
      const accountSid = safeString(creds.accountSid);
      const authToken = safeString(creds.authToken);
      const fromNumber = safeString(creds.fromNumber);
      if (!accountSid || !authToken || !fromNumber) {
        return deepFreeze({
          ok: false,
          reason: "sms_not_configured",
          message: "Connect Twilio SMS (VIBETech provisioning or your own account) before proving the appointment setter.",
        });
      }
      const { resolveInboundSmsWebhookUrl } = await import("../twilio/TwilioProvisioningService.js");
      const expectedWebhook = resolveInboundSmsWebhookUrl(businessId);
      // Best-effort — a probe failure or missing APP_ORIGIN doesn't fail the prove;
      // Twilio credentials being live and callable is the real thing being proven.
      let webhookConfigured = null;
      try {
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(fromNumber)}`,
          { headers: { Authorization: `Basic ${auth}` } },
        );
        const data = await res.json().catch(() => ({}));
        const row = Array.isArray(data?.incoming_phone_numbers) ? data.incoming_phone_numbers[0] : null;
        if (row && expectedWebhook) {
          webhookConfigured = safeString(row.sms_url) === expectedWebhook;
        }
      } catch {
        webhookConfigured = null;
      }
      return deepFreeze({
        ok: true,
        simulated: false,
        provider: "twilio_sms",
        fromNumber,
        expectedWebhook: expectedWebhook || null,
        webhookConfigured,
        message: webhookConfigured === true
          ? "Twilio SMS is configured and the inbound webhook points to the appointment setter route."
          : "Twilio SMS is configured for the appointment setter. Could not confirm the inbound webhook automatically — check Twilio Console → Phone Numbers if replies aren't reaching the setter.",
      });
    }

    if (act === PROVE_ACTIONS.place_test_call) {
      const { TwilioVoiceIntegrationAdapter } = await import("../adapters/TwilioVoiceIntegrationAdapter.js");
      const adapter = new TwilioVoiceIntegrationAdapter({ nowISO: new Date().toISOString() });
      const to = normalizeProvePhone(provePhone);
      if (!to) {
        return deepFreeze({
          ok: false,
          reason: "prove_phone_required",
          message: "Enter a phone number (with country code) to receive the prove call.",
        });
      }
      // Prefer hosted inbound TwiML for the workspace when available.
      const origin = safeString(process.env.NEXTAUTH_URL || process.env.APP_ORIGIN || "").replace(/\/$/, "");
      const defaultTwiml = origin
        ? `${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/voice/inbound`
        : "";
      const twimlUrl = String(
        matching.secrets?.twimlUrl
        || matching.metadata?.twimlUrl
        || process.env.TWILIO_VOICE_TWIML_URL
        || defaultTwiml
        || "",
      ).trim();
      if (!twimlUrl) {
        // Credential verify only when no TwiML URL can be resolved.
        const verified = await adapter.verifyConnection({ connection, credentialResolver });
        if (verified?.status !== "success") {
          return deepFreeze({
            ok: false,
            reason: verified?.code ?? "voice_verify_failed",
            message: verified?.message ?? "Could not verify Twilio Voice credentials.",
            provider: "twilio_voice",
          });
        }
        const verifyMeta = buildPlaceTestCallMetadata(knowledgeCount, { dialOut: false, credentialVerifyOnly: true });
        return deepFreeze({
          ok: true,
          simulated: false,
          provider: "twilio_voice",
          externalReference: matching.credentialId ?? "twilio_voice_verified",
          message: "Twilio Voice credentials verified. Set APP/NEXTAUTH URL so prove can place a live call.",
          metadata: verifyMeta,
          detail: { ...verifyMeta, awaitingOwnerConfirm: true },
        });
      }
      const result = await adapter.executeAction({
        actionRequest: {
          capability: INTEGRATION_CAPABILITIES.PLACE_VOICE_CALL,
          parameters: { to, twimlUrl },
        },
        connection,
        credentialResolver,
      });
      if (result?.status !== "completed" || !result?.externalReference) {
        return deepFreeze({
          ok: false,
          reason: result?.error ?? "voice_call_failed",
          message: result?.error || "Twilio did not place the prove call.",
          provider: "twilio_voice",
          detail: result,
        });
      }
      try {
        const { recordUsageSafe } = await import("../../platform/billing/UsageMetering.js");
        recordUsageSafe({
          businessId,
          meterId: "voice_minutes_outbound",
          quantity: 1,
          platformStore,
        });
      } catch {
        /* non-blocking */
      }
      // Dial-out proved; conversational claim stays incomplete until owner confirm (+ knowledge when claiming cite).
      const callMeta = buildPlaceTestCallMetadata(knowledgeCount, {
        dialOut: true,
        callSid: result.externalReference,
        twimlUrl,
      });
      return deepFreeze({
        ok: true,
        simulated: false,
        provider: "twilio_voice",
        to,
        externalReference: result.externalReference,
        message: Number(knowledgeCount) > 0
          ? "Prove call placed. Answer to hear the AI receptionist (knowledge-backed greeting), then confirm you heard it. Outbound customer calls stay approval-gated."
          : "Prove call placed (dial-out only). Upload Knowledge before claiming a conversational/cite prove, then confirm you heard the greeting.",
        metadata: callMeta,
        detail: { ...callMeta, awaitingOwnerConfirm: true, externalReference: result.externalReference },
      });
    }

    if (act === PROVE_ACTIONS.ingest_test_lead) {
      const { ingestMetaLead } = await import("../meta/ingestMetaLead.js");
      const leadgenId = `prove_${Date.now()}`;
      const pageId = String(matching.metadata?.pageId ?? matching.secrets?.pageId ?? "prove_page");
      // Prove without calling live Graph — still creates CRM contact + META_LEAD emit when workspace provided.
      const syntheticLead = {
        id: leadgenId,
        created_time: new Date().toISOString(),
        field_data: [
          { name: "full_name", values: ["Prove Test Lead"] },
          { name: "email", values: [String(proveEmail || "prove-lead@example.com")] },
          { name: "phone_number", values: [String(provePhone || "+15555550100")] },
        ],
        form_id: "prove_form",
        page_id: pageId,
      };
      // Live prove route may not have workspaceService — CRM path still validates intake.
      const ingested = await ingestMetaLead({
        businessId,
        leadgenId,
        formId: "prove_form",
        pageId,
        platformStore,
        syntheticLead,
        prove: true,
        actorId: "meta_prove",
      });
      if (!ingested.ok) {
        return deepFreeze({
          ok: false,
          reason: ingested.reason ?? "meta_ingest_failed",
          message: ingested.message ?? "Could not prove Meta lead intake.",
          provider: "meta_lead_ads",
        });
      }
      const followUpDraft = {
        id: `draft_meta_prove_${leadgenId}`,
        channel: "email",
        status: "pending_approval",
        subject: "Thanks — we received your inquiry",
        bodyPreview: "Thanks for reaching out via Facebook. We received your inquiry and will follow up shortly.",
        contactId: ingested.contactId ?? null,
        cardId: ingested.cardId ?? null,
        recipientEmail: String(proveEmail || "prove-lead@example.com"),
        audience: "prove_meta_lead",
        createdAt: new Date().toISOString(),
        source: "meta_lead_prove",
      };
      try {
        const fresh = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
        if (fresh) {
          const drafts = Array.isArray(fresh?.configuration?.pendingDecisionDrafts)
            ? fresh.configuration.pendingDecisionDrafts.filter((d) => d?.id !== followUpDraft.id)
            : [];
          drafts.push(followUpDraft);
          await platformStore.upsertBusinessOSInstallation({
            id: fresh.id ?? fresh.installationId ?? `install_${businessId}`,
            businessId,
            specificationRowId: fresh.specificationRowId ?? null,
            specificationId: fresh.specificationId ?? `spec_${businessId}`,
            specificationVersion: fresh.specificationVersion ?? 1,
            specificationContentHash: fresh.specificationContentHash ?? fresh.contentHash ?? "meta_prove",
            planId: fresh.planId ?? `plan_${businessId}`,
            status: fresh.status ?? "installed",
            plan: fresh.plan ?? {},
            actionCheckpoints: Array.isArray(fresh.actionCheckpoints) ? fresh.actionCheckpoints : [],
            configuration: {
              ...(fresh.configuration ?? {}),
              pendingDecisionDrafts: drafts.slice(-25),
            },
            history: Array.isArray(fresh.history) ? fresh.history.slice(-50) : [],
            installedAt: fresh.installedAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: "meta_prove",
          });
        }
      } catch {
        /* best-effort */
      }
      return deepFreeze({
        ok: true,
        simulated: false,
        provider: "meta_lead_ads",
        lead: {
          leadgenId,
          formId: "prove_form",
          pageId,
          contactId: ingested.contactId,
          cardId: ingested.cardId,
        },
        followUpDraft,
        detail: {
          followUpDraft,
          pendingApproval: true,
          contactId: ingested.contactId,
          cardId: ingested.cardId,
        },
        message: "Test Facebook lead saved to People with a pending follow-up draft for Decisions. Live form leads use the same path via webhook.",
      });
    }

    return deepFreeze({
      ok: false,
      reason: "unsupported_prove_action",
      message: `No live executor for action ${act}`,
    });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: "prove_provider_error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function matchesConnection(credential, connectionId, action) {
  const provider = String(credential?.providerType ?? "").toLowerCase();
  if (action === PROVE_ACTIONS.send_test_email) {
    // Must be Gmail — never match google_calendar / other Google tokens.
    return provider === "gmail" || provider.startsWith("gmail_");
  }
  if (action === PROVE_ACTIONS.create_test_event || action === PROVE_ACTIONS.book_test_slot) {
    return provider === "google_calendar" || provider.includes("calendar");
  }
  if (action === PROVE_ACTIONS.send_test_sms || action === PROVE_ACTIONS.prove_appointment_setter_sms) {
    return provider === "twilio_sms" || provider.includes("twilio_sms") || (provider.includes("twilio") && provider.includes("sms"));
  }
  if (action === PROVE_ACTIONS.ingest_test_lead) {
    return provider === "meta_lead_ads" || provider.includes("meta_lead");
  }
  if (action === PROVE_ACTIONS.place_test_call) {
    return provider === "twilio_voice" || provider.includes("twilio_voice") || (provider.includes("twilio") && provider.includes("voice"));
  }
  return false;
}

function mapAdapterResult(result, extra = {}) {
  if (result?.status === "completed") {
    return deepFreeze({
      ok: true,
      simulated: false,
      ...extra,
      externalReference: result.externalReference ?? null,
      metadata: result.metadata ?? {},
    });
  }
  const raw = String(result?.error ?? "Prove provider returned failure");
  return deepFreeze({
    ok: false,
    reason: result?.error ?? "prove_failed",
    message: humanizeProveProviderError(raw, extra?.provider),
    ...extra,
    detail: result,
  });
}

function humanizeProveProviderError(raw, provider) {
  const text = String(raw ?? "");
  if (/insufficient.*scope|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(text)) {
    if (provider === "gmail") {
      return "Google didn’t grant send permission. Reconnect business email (not Connect locally), and on Google’s screen check “Send email on your behalf.”";
    }
    return "Google permission is missing a required scope. Reconnect this integration and approve all requested access.";
  }
  if (/message\.body required|message_body required/i.test(text)) {
    return "Email prove payload was invalid. Refresh the page and try Run test again.";
  }
  return text || "Prove provider returned failure";
}

function normalizeProvePhone(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const digits = text.replace(/\D/g, "");
  if (text.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return text.replace(/[\s()-]/g, "");
}

/**
 * Resolve CONNECTED vs NOT_CONNECTED from vault credentials + connected systems snapshot.
 */
export function resolveProveConnectionStatus({
  action,
  credentials = [],
  connections = [],
} = {}) {
  const act = String(action ?? "");
  // Golden paths / connectionless proves don't need a mapped provider id here.
  if (
    act === PROVE_ACTIONS.upload_and_cite
    || act === PROVE_ACTIONS.approve_and_send
    || act === PROVE_ACTIONS.submit_test_form
    || act === PROVE_ACTIONS.prove_team_availability
  ) {
    return "CONNECTED";
  }

  if (act === PROVE_ACTIONS.sync_test_crm_contact) {
    const crmSnap = connections.find((c) => ["hubspot", "highlevel"].includes(String(c.id)));
    if (crmSnap && String(crmSnap.status).toUpperCase() === "CONNECTED") return "CONNECTED";
    if (credentials.some((c) => /hubspot|highlevel/i.test(String(c.providerType ?? c.credentialId ?? "")))) {
      return "CONNECTED";
    }
    return "NOT_CONNECTED";
  }

  const connectionId = ACTION_TO_CONNECTION[act] ?? null;
  if (connectionId) {
    const snap = connections.find((c) => String(c.id) === connectionId);
    if (snap && String(snap.status).toUpperCase() === "CONNECTED") return "CONNECTED";
  }
  if (credentials.some((c) => matchesConnection(c, connectionId, act))) return "CONNECTED";

  // Fallback: any connected business_email credential unlocks sports/dental golden path.
  if (act === PROVE_ACTIONS.run_sports_golden_path || act === PROVE_ACTIONS.run_dental_golden_path) {
    const emailSnap = connections.find((c) => String(c.id) === "business_email");
    if (emailSnap && String(emailSnap.status).toUpperCase() === "CONNECTED") return "CONNECTED";
    if (credentials.some((c) => /gmail|business_email|email/i.test(String(c.providerType ?? c.connectionType ?? "")))) {
      return "CONNECTED";
    }
  }

  return "NOT_CONNECTED";
}
