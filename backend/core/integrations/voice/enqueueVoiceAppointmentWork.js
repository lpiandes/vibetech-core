/**
 * Create appointment Work when voice/form booking fires — and persist WORK snapshot.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { persistAffectedRuntimes } from "../../persistence/PersistedMutationCoordinator.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";

export function buildVoiceAppointmentWorkDraft({
  businessId,
  speech = "",
  from = "",
  callSid = "",
  reply = "",
  nowISO = () => new Date().toISOString(),
} = {}) {
  const at = typeof nowISO === "function" ? nowISO() : String(nowISO);
  const workId = `work_voice_appt_${String(callSid || Date.now()).replace(/\W/g, "").slice(-20)}`;
  return deepFreeze({
    id: workId,
    workType: "appointment_request",
    title: from ? `Appointment request from ${from}` : "Appointment request from phone call",
    status: "open",
    priority: "high",
    createdAt: at,
    updatedAt: at,
    description: [
      "Voice receptionist captured a booking request.",
      speech ? `Caller said: ${speech}` : null,
      reply ? `Receptionist replied: ${reply}` : null,
      "Confirm a time with the caller. A calendar HOLD is created when Google Calendar is connected.",
    ].filter(Boolean).join("\n"),
    metadata: {
      customAi: true,
      needsYou: true,
      source: "voice_receptionist",
      intent: "book",
      phone: from || null,
      callSid: callSid || null,
      businessId: businessId || null,
      glance: {
        title: from ? `Appointment request: ${from}` : "Appointment request from a caller",
        summary: "Phone booking · Confirm hold / schedule with caller",
        whyNeedsYou: "Open Work (and Calendar if connected) and confirm the appointment.",
        needsYou: true,
        workHref: businessId && workId
          ? `/b/${encodeURIComponent(String(businessId))}/work?workId=${encodeURIComponent(workId)}`
          : null,
      },
    },
  });
}

function resolvePersistContext(workspace, businessId) {
  const workspaceId = String(
    businessId
    ?? workspace?.workspaceId
    ?? workspace?.connected?.workspaceId
    ?? "",
  ).trim();
  const stack = workspace?.connected?.operatingStack
    ?? workspace?.connected?.ctx
    ?? workspace?.operatingStack
    ?? workspace;
  const integrationPlatform = workspace?.connected?.integrationPlatform
    ?? workspace?.integrationPlatform
    ?? null;
  return { workspaceId, stack, integrationPlatform };
}

/**
 * Best-effort: push appointment Work onto the live workspace workRuntime and persist.
 */
export async function enqueueVoiceAppointmentWork({
  businessId,
  speech,
  from,
  callSid,
  reply,
  getWorkspace = null,
  nowISO = () => new Date().toISOString(),
  persist = persistAffectedRuntimes,
} = {}) {
  const draft = buildVoiceAppointmentWorkDraft({
    businessId,
    speech,
    from,
    callSid,
    reply,
    nowISO,
  });
  if (typeof getWorkspace !== "function") {
    return deepFreeze({ ok: false, reason: "workspace_loader_missing", draft });
  }
  try {
    const workspace = await getWorkspace(businessId);
    const workRuntime = workspace?.workRuntime ?? workspace?.connected?.ctx?.workRuntime ?? null;
    if (!workRuntime?.applyEvent) {
      return deepFreeze({ ok: false, reason: "work_runtime_unavailable", draft });
    }
    const at = typeof nowISO === "function" ? nowISO() : String(nowISO);
    workRuntime.applyEvent({
      id: `evt_${draft.id}_create`,
      type: "WORK_ITEM_CREATED",
      at,
      actorId: "voice_receptionist",
      payload: { workItem: draft },
    });

    let persisted = false;
    const { workspaceId, stack, integrationPlatform } = resolvePersistContext(workspace, businessId);
    if (workspaceId && typeof persist === "function") {
      try {
        await persist({
          workspaceId,
          stack,
          integrationPlatform,
          kinds: [RUNTIME_SNAPSHOT_KINDS.WORK],
        });
        persisted = true;
      } catch (err) {
        return deepFreeze({
          ok: true,
          workId: draft.id,
          draft,
          persisted: false,
          persistError: err instanceof Error ? err.message : "persist_failed",
        });
      }
    }

    return deepFreeze({ ok: true, workId: draft.id, draft, persisted });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: err instanceof Error ? err.message : "enqueue_failed",
      draft,
    });
  }
}
