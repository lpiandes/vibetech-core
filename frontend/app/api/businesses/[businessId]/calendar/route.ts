import { NextResponse } from "next/server";

import {
  getAuthorizedWorkspace,
  getAuthorizedBusinessScope,
  authorizationErrorResponse,
} from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore, withClient } from "@/lib/server/compose";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import { workspaceCompositionRegistry } from "@/lib/workspace/WorkspaceCompositionRegistry";
import {
  readCrmState,
  writeCrmState,
  upsertCalendarEvent,
  removeCalendarEvent,
} from "../../../../../../backend/core/crm/CrmStore.js";
import { INTEGRATION_CAPABILITIES } from "../../../../../../backend/core/integrations/capabilities/IntegrationCapability.js";
import {
  ensureCalendarReminderEmployee,
  enqueueCalendarReminderJobs,
  rescheduleCalendarReminderJobs,
  CALENDAR_REMINDER_EMPLOYEE_ID,
} from "../../../../../../backend/core/ai-builder/specialty/calendarReminderEngine.js";
import { PostgresPlatformJobQueue } from "../../../../../../backend/core/platform/jobs/PostgresPlatformJobQueue.js";
import { resolveOperatingIndustry } from "../../../../../../backend/core/ai-builder/mapPackAiRolesToSelectedEmployees.js";

async function loadInstallation(businessId: string) {
  return getCachedBusinessOsInstallation(businessId).catch(() => null);
}

async function runCalendarCapability({
  hub,
  businessId,
  capability,
  parameters,
  actorId = "system",
}: {
  hub: any;
  businessId: string;
  capability: string;
  parameters: Record<string, unknown>;
  actorId?: string;
}) {
  const orchestrator = hub?.actionOrchestrator;
  if (!orchestrator?.execute) {
    // Fallback: call provider directly if connected
    const provider = hub?.providerRegistry?.getProvider?.("google_calendar");
    const connection = hub?.connectionRuntime?.getConnectionByType?.("calendar")
      ?? (hub?.connectionRuntime?.getConnections?.() ?? []).find(
        (c: any) => String(c.connectionType ?? "").includes("calendar"),
      );
    if (!provider?.executeAction || !connection) return null;
    return provider.executeAction({
      actionRequest: { capability, parameters },
      connection,
      credentialResolver: hub.credentialResolver,
    });
  }
  return orchestrator.execute({
    id: `cal_${capability}_${Date.now().toString(36)}`,
    workspaceId: businessId,
    capability,
    providerId: "google_calendar",
    source: "calendar_api",
    requestedBy: actorId,
    parameters,
    requiresApproval: false,
    outboundApproved: true,
  });
}

async function persistEmployees(installation: any, employees: any[], actorId: string) {
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "calendar_reminder_employee",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: {
      ...(installation.configuration ?? {}),
      employees,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history : []),
      {
        at: new Date().toISOString(),
        action: "ensure_calendar_reminder_employee",
        actorId,
      },
    ],
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? null,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.PEOPLE_VIEW);
    const url = new URL(request.url);
    const timeMin = url.searchParams.get("timeMin") || new Date().toISOString();
    const timeMax = url.searchParams.get("timeMax") || null;

    const installation = await loadInstallation(businessId);
    const crm = readCrmState(installation);
    let googleMirrorConnected = false;
    let googleEvents: any[] = [];

    // Prefer warm in-memory hub — do not cold-activate workspace just to list events.
    try {
      const connected = workspaceCompositionRegistry.get(businessId) as any;
      const hub = connected?.integrationPlatform;
      const connections = hub?.connectionRuntime?.getConnections?.()
        ?? connected?.connectedSystemsSnapshot?.connections
        ?? [];
      const calConn = (Array.isArray(connections) ? connections : []).find(
        (c: any) => String(c.connectionType ?? c.type ?? "").includes("calendar")
          || String(c.providerId ?? "").includes("calendar"),
      );
      if (calConn && hub) {
        googleMirrorConnected = true;
        const result = await runCalendarCapability({
          hub,
          businessId,
          capability: INTEGRATION_CAPABILITIES.LIST_CALENDAR_EVENTS,
          parameters: { timeMin, timeMax, maxResults: 80 },
        });
        const listed = result?.metadata?.events ?? [];
        if (Array.isArray(listed)) googleEvents = listed;
      }
    } catch {
      /* VIBETech org calendar still works */
    }

    const local = (crm.calendarEvents ?? []).map((e: any) => ({
      ...e,
      source: e.source || "vibetech",
    }));

    // Dedupe: creating an event writes VIBETech + Google mirror. Never show both.
    const merged = mergeOrgCalendarEvents(local, googleEvents);

    return NextResponse.json({
      ok: true,
      /** Org truth is always VIBETech; Google is optional phone sync for an admin. */
      orgSource: "vibetech",
      googleMirrorConnected,
      calendarConnected: googleMirrorConnected,
      events: merged,
      orgEventCount: local.length,
      reminderPolicy: {
        offsets: ["24h", "1h", "10m"],
        automation: "Calendar Reminder AI",
        audience: "Everyone with org calendar access",
      },
      memberCalendarHint: googleMirrorConnected
        ? "Org schedule lives in VIBETech. Google mirror is on for phones. Members connect their own Google under Me for free/busy."
        : "Org schedule lives in VIBETech. Optional: admin syncs Google for phone mirrors. Members connect personal Google for Me overlay.",
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

/** Prefer VIBETech rows; attach Meet links from Google; drop duplicate Google copies. */
function mergeOrgCalendarEvents(local: any[], googleEvents: any[]) {
  const fingerprint = (title: string, start: string) =>
    `${String(title ?? "").trim().toLowerCase()}|${String(start ?? "").slice(0, 16)}`;

  const byExternalId = new Map<string, any>();
  const byFingerprint = new Map<string, any>();
  const out: any[] = [];

  for (const e of local) {
    const row = { ...e, source: e.source || "vibetech" };
    out.push(row);
    if (row.externalId) byExternalId.set(String(row.externalId), row);
    byFingerprint.set(fingerprint(row.title, row.start), row);
  }

  for (const g of googleEvents) {
    const gId = String(g.id ?? "");
    const title = String(g.summary ?? g.title ?? "");
    const start = String(g.start ?? "");
    const fp = fingerprint(title, start);
    const existing = (gId && byExternalId.get(gId)) || byFingerprint.get(fp);
    if (existing) {
      if (!existing.conferenceUrl && (g.conferenceUrl || g.hangoutLink)) {
        existing.conferenceUrl = g.conferenceUrl || g.hangoutLink;
        existing.conferenceType = existing.conferenceType || g.conferenceType || "google_meet";
      }
      if (!existing.htmlLink && g.htmlLink) existing.htmlLink = g.htmlLink;
      if (!existing.externalId && gId) existing.externalId = gId;
      continue;
    }
    out.push({
      id: gId || `gcal_${fp}`,
      title,
      description: g.description,
      start,
      end: g.end,
      htmlLink: g.htmlLink,
      conferenceUrl: g.conferenceUrl ?? g.hangoutLink ?? null,
      conferenceType: g.conferenceType ?? (g.conferenceUrl || g.hangoutLink ? "google_meet" : null),
      location: g.location ?? "",
      source: "google_mirror",
      visibility: "org",
      externalId: gId || null,
    });
  }

  return out.sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    let installation = await loadInstallation(businessId);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }

    const title = String(body.title ?? body.summary ?? "").trim();
    const description = String(body.description ?? body.body ?? "").trim();
    const start = String(body.start ?? "").trim();
    const end = String(body.end ?? "").trim();
    const conferenceTypeRaw = String(body.conferenceType ?? "none").trim().toLowerCase();
    const conferenceType = ["google_meet", "zoom"].includes(conferenceTypeRaw) ? conferenceTypeRaw : "none";
    let conferenceUrl = String(body.conferenceUrl ?? body.zoomUrl ?? body.meetUrl ?? "").trim();
    if (!title || !start || !end) {
      return NextResponse.json({ ok: false, error: "title, start, and end required" }, { status: 400 });
    }
    if (conferenceType === "zoom" && !conferenceUrl) {
      return NextResponse.json({
        ok: false,
        error: "Paste a Zoom link, or connect Zoom in Integrations for auto-create (coming next).",
        code: "zoom_link_required",
      }, { status: 400 });
    }

    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    const industry = resolveOperatingIndustry({
      industry: installation?.configuration?.businessProfile?.industry,
      businessName: installation?.configuration?.businessProfile?.businessName,
      operatingPackId: installation?.configuration?.operatingPackId,
      configuration: installation?.configuration,
    });

    // Ensure Calendar Reminder AI teammate exists (custom automation)
    const employeesIn = Array.isArray(installation.configuration?.employees)
      ? installation.configuration.employees
      : [];
    const ensured = ensureCalendarReminderEmployee({ employees: employeesIn, industry });
    if (ensured.created) {
      await persistEmployees(installation, ensured.employees, actorId);
      installation = await loadInstallation(businessId) ?? installation;
    }
    const reminderEmployeeId = String(
      ensured.employee?.employeeId ?? CALENDAR_REMINDER_EMPLOYEE_ID,
    );

    // Optional Google mirror write — Google Meet auto-creates when requested + calendar connected
    let externalId: string | null = null;
    let htmlLink: string | null = null;
    let meetCreated = false;
    let conferenceWarning: string | null = null;
    try {
      const hub = (ctx.service as any)?.connected?.integrationPlatform;
      const connections = hub?.connectionRuntime?.getConnections?.() ?? [];
      const calConn = (Array.isArray(connections) ? connections : []).find(
        (c: any) => String(c.connectionType ?? c.type ?? "").includes("calendar")
          || String(c.providerId ?? "").includes("calendar"),
      );
      if (calConn) {
        const result = await runCalendarCapability({
          hub,
          businessId,
          capability: INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT,
          actorId,
          parameters: {
            summary: title,
            description,
            start: { dateTime: start },
            end: { dateTime: end },
            createGoogleMeet: conferenceType === "google_meet",
            conferenceType: conferenceType === "none" ? null : conferenceType,
            conferenceUrl: conferenceType === "zoom" ? conferenceUrl : undefined,
          },
        });
        const status = String(result?.status ?? "").toLowerCase();
        if (status === "completed" || status === "COMPLETED".toLowerCase()) {
          externalId = result?.externalReference ?? null;
          htmlLink = result?.metadata?.htmlLink ?? null;
          if (conferenceType === "google_meet") {
            const autoUrl = result?.metadata?.conferenceUrl ?? result?.metadata?.hangoutLink ?? null;
            if (autoUrl) {
              conferenceUrl = String(autoUrl);
              meetCreated = true;
            } else {
              conferenceWarning = "Google Calendar wrote the event but no Meet link returned — check calendar scopes.";
            }
          }
        } else if (conferenceType === "google_meet") {
          conferenceWarning = result?.error
            ? String(result.error)
            : "Connect Google Calendar (mirror) to auto-create a Meet link.";
        }
      } else if (conferenceType === "google_meet") {
        conferenceWarning = "Connect Google Calendar (mirror) to auto-create a Meet link.";
      }
    } catch (err) {
      if (conferenceType === "google_meet") {
        conferenceWarning = err instanceof Error ? err.message : "Google Meet could not be created — event still saved in VIBETech.";
      }
    }

    let crm = readCrmState(installation);
    crm = upsertCalendarEvent(crm, {
      title,
      description,
      start,
      end,
      source: "vibetech",
      externalId,
      htmlLink,
      visibility: "org",
      audience: "org_members",
      createdBy: actorId,
      conferenceType: conferenceType === "none" ? null : conferenceType,
      conferenceUrl: conferenceUrl || null,
      location: conferenceUrl || "",
    });
    await writeCrmState({ platformStore, installation, crm, actorId });

    const created = crm.calendarEvents.find(
      (e: any) => e.title === title && e.start === start,
    ) ?? crm.calendarEvents[crm.calendarEvents.length - 1];

    // Schedule 24h / 1h / 10m reminder jobs → Calendar Reminder AI drafts
    let reminders: any = { ok: false, count: 0 };
    try {
      const queue = new PostgresPlatformJobQueue({ withClient });
      reminders = await enqueueCalendarReminderJobs({
        queue,
        businessId,
        event: created,
        employeeId: reminderEmployeeId,
      });
    } catch {
      reminders = { ok: false, reason: "enqueue_failed", count: 0 };
    }

    // Fan-out to every LIVE automation subscribed to schedule changes
    // (Parent Communications, Calendar Reminder, etc.) — not a single hardcoded teammate.
    try {
      await (ctx.service as any).emitSpecialtyBusinessEvent?.({
        eventType: "SCHEDULE_CHANGE",
        brief: `Club calendar event created: ${title} at ${start}`,
        forceManual: false,
        actorId,
        eventPayload: {
          title,
          start,
          end,
          calendarEventId: created?.id ?? null,
        },
      });
    } catch {
      /* best effort */
    }

    return NextResponse.json({
      ok: true,
      event: created,
      reminders,
      reminderEmployeeId,
      meetCreated,
      conferenceWarning,
      crm: { calendarEvents: crm.calendarEvents },
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const eventId = String(body.id ?? body.eventId ?? "").trim();
    if (!eventId) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }
    const installation = await loadInstallation(businessId);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    let crm = readCrmState(installation);
    const existing = (crm.calendarEvents ?? []).find(
      (e: any) => String(e.id) === eventId || String(e.externalId ?? "") === eventId,
    );
    const googleId = String(existing?.externalId ?? "").trim();
    let googleDelete: any = null;
    if (googleId) {
      try {
        const hub = (ctx.service as any)?.connected?.integrationPlatform?.hub
          ?? (ctx.service as any)?.connected?.hub
          ?? null;
        googleDelete = await runCalendarCapability({
          hub,
          businessId,
          capability: INTEGRATION_CAPABILITIES.DELETE_CALENDAR_EVENT,
          parameters: { eventId: googleId },
          actorId,
        });
      } catch (err) {
        googleDelete = { status: "failed", error: err instanceof Error ? err.message : String(err) };
      }
    }

    const queue = new PostgresPlatformJobQueue({ withClient });
    if (existing?.id) {
      await queue.cancelPendingByIdempotencyPrefix({
        businessId,
        jobType: "calendar_reminder_due",
        idempotencyPrefix: `calendar_reminder:${businessId}:${existing.id}:`,
      }).catch(() => null);
    }

    crm = removeCalendarEvent(crm, { eventId: existing?.id ?? eventId });
    await writeCrmState({ platformStore, installation, crm, actorId });

    return NextResponse.json({
      ok: true,
      googleDelete,
      crm: { calendarEvents: crm.calendarEvents },
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const eventId = String(body.id ?? body.eventId ?? "").trim();
    if (!eventId) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }
    const installation = await loadInstallation(businessId);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    let crm = readCrmState(installation);
    const existing = (crm.calendarEvents ?? []).find(
      (e: any) => String(e.id) === eventId || String(e.externalId ?? "") === eventId,
    );
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
    }
    const nextTitle = body.title != null ? String(body.title).trim() : existing.title;
    const nextStart = body.start != null ? String(body.start).trim() : existing.start;
    const nextEnd = body.end != null ? String(body.end).trim() : existing.end;
    const nextDescription = body.description != null ? String(body.description) : existing.description;
    const conferenceTypeRaw = body.conferenceType != null
      ? String(body.conferenceType).trim().toLowerCase()
      : String(existing.conferenceType ?? "none").toLowerCase();
    const nextConferenceType = ["google_meet", "zoom"].includes(conferenceTypeRaw)
      ? conferenceTypeRaw
      : "none";
    const nextConferenceUrl = nextConferenceType === "zoom"
      ? String(body.conferenceUrl ?? existing.conferenceUrl ?? "").trim()
      : (nextConferenceType === "google_meet" ? (existing.conferenceUrl ?? null) : null);
    if (!nextTitle || !nextStart || !nextEnd) {
      return NextResponse.json({ ok: false, error: "title, start, and end required" }, { status: 400 });
    }
    if (nextConferenceType === "zoom" && !nextConferenceUrl) {
      return NextResponse.json({ ok: false, error: "Zoom URL required" }, { status: 400 });
    }

    let googleUpdate: any = null;
    const googleId = String(existing.externalId ?? "").trim();
    if (googleId) {
      try {
        const hub = (ctx.service as any)?.connected?.integrationPlatform?.hub
          ?? (ctx.service as any)?.connected?.hub
          ?? null;
        googleUpdate = await runCalendarCapability({
          hub,
          businessId,
          capability: INTEGRATION_CAPABILITIES.UPDATE_CALENDAR_EVENT,
          parameters: {
            eventId: googleId,
            summary: nextTitle,
            title: nextTitle,
            description: nextDescription,
            start: { dateTime: nextStart },
            end: { dateTime: nextEnd },
          },
          actorId,
        });
      } catch (err) {
        googleUpdate = { status: "failed", error: err instanceof Error ? err.message : String(err) };
      }
    }

    crm = upsertCalendarEvent(crm, {
      ...existing,
      id: existing.id,
      title: nextTitle,
      start: nextStart,
      end: nextEnd,
      description: nextDescription,
      conferenceType: nextConferenceType === "none" ? null : nextConferenceType,
      conferenceUrl: nextConferenceType === "none" ? null : nextConferenceUrl,
    });
    await writeCrmState({ platformStore, installation, crm, actorId });
    const updated = (crm.calendarEvents ?? []).find((e: any) => String(e.id) === String(existing.id));

    const reminderEmployeeId = String(
      (installation.configuration?.employees ?? []).find((e: any) =>
        String(e.employeeId ?? e.id ?? "").includes("calendar_reminder"),
      )?.employeeId
      ?? CALENDAR_REMINDER_EMPLOYEE_ID,
    );
    const queue = new PostgresPlatformJobQueue({ withClient });
    let reminders: any = { ok: false, count: 0 };
    try {
      reminders = await rescheduleCalendarReminderJobs({
        queue,
        businessId,
        event: updated,
        employeeId: reminderEmployeeId,
      });
    } catch {
      reminders = { ok: false, reason: "reschedule_failed", count: 0 };
    }

    return NextResponse.json({
      ok: true,
      event: updated,
      googleUpdate,
      reminders,
      crm: { calendarEvents: crm.calendarEvents },
      note: googleId
        ? "VIBETech calendar updated; Google mirror updated when connected."
        : "VIBETech calendar updated (no Google externalId to sync).",
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
