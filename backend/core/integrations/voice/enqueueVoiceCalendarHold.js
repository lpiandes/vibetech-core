/**
 * When voice booking fires and Google Calendar is connected, place a HOLD event
 * the team can confirm/reschedule. Always paired with appointment Work.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { GoogleCalendarIntegrationAdapter } from "../adapters/GoogleCalendarIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";

function findCalendarConnection(workspace) {
  const hub = workspace?.connected?.integrationPlatform
    ?? workspace?.integrationPlatform
    ?? null;
  const runtime = hub?.connectionRuntime;
  if (!runtime) return { hub: null, connection: null };
  const byType = runtime.getConnectionByType?.("calendar")
    ?? runtime.getConnectionByType?.("google_calendar")
    ?? null;
  if (byType) return { hub, connection: byType };
  const all = runtime.getConnections?.() ?? [];
  const connection = (Array.isArray(all) ? all : []).find((c) => {
    const type = String(c?.connectionType ?? c?.type ?? "").toLowerCase();
    const provider = String(c?.providerId ?? "").toLowerCase();
    return type.includes("calendar") || provider.includes("calendar");
  }) ?? null;
  return { hub, connection };
}

export function buildVoiceCalendarHoldParams({
  from = "",
  speech = "",
  callSid = "",
  nowMs = Date.now(),
} = {}) {
  const start = new Date(nowMs + 24 * 60 * 60 * 1000);
  // Round to next hour for a clear hold slot.
  start.setMinutes(0, 0, 0);
  if (start.getTime() <= nowMs) start.setTime(start.getTime() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const who = from || "phone caller";
  return deepFreeze({
    summary: `HOLD: Appointment request from ${who}`,
    description: [
      "Voice receptionist booking hold — confirm or reschedule with the caller before treating as final.",
      speech ? `Caller said: ${speech}` : null,
      callSid ? `Call SID: ${callSid}` : null,
      from ? `Phone: ${from}` : null,
    ].filter(Boolean).join("\n"),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  });
}

/**
 * Best-effort calendar HOLD when connection + credentials exist.
 */
export async function enqueueVoiceCalendarHold({
  businessId,
  speech,
  from,
  callSid,
  getWorkspace = null,
  adapter = null,
  nowMs = Date.now(),
} = {}) {
  if (typeof getWorkspace !== "function") {
    return deepFreeze({ ok: false, reason: "workspace_loader_missing" });
  }
  try {
    const workspace = await getWorkspace(businessId);
    const { hub, connection } = findCalendarConnection(workspace);
    if (!connection) {
      return deepFreeze({ ok: false, reason: "calendar_not_connected" });
    }
    const status = String(connection.status ?? "").toUpperCase();
    if (status && status !== "CONNECTED" && status !== "VERIFIED" && status !== "ACTIVE") {
      return deepFreeze({ ok: false, reason: "calendar_not_connected", status });
    }
    const credentialResolver = hub?.credentialResolver ?? null;
    if (!credentialResolver) {
      return deepFreeze({ ok: false, reason: "credential_resolver_missing" });
    }
    const parameters = buildVoiceCalendarHoldParams({ from, speech, callSid, nowMs });
    const calendar = adapter ?? new GoogleCalendarIntegrationAdapter({
      nowISO: new Date(nowMs).toISOString(),
    });
    const result = await calendar.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT,
        parameters,
      },
      connection,
      credentialResolver,
    });
    const completed = String(result?.status ?? "").toLowerCase() === "completed";
    if (!completed) {
      return deepFreeze({
        ok: false,
        reason: result?.error ?? "calendar_create_failed",
        result,
      });
    }
    return deepFreeze({
      ok: true,
      externalReference: result?.externalReference ?? null,
      htmlLink: result?.metadata?.htmlLink ?? null,
      hold: parameters,
    });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: err instanceof Error ? err.message : "calendar_hold_failed",
    });
  }
}
