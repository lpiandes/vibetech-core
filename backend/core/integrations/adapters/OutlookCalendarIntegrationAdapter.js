import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { callMicrosoftGraph, isMicrosoftOAuthAppConfigured } from "../oauth/MicrosoftOAuthClient.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

/**
 * Graph event start/end fields are `{ dateTime, timeZone }` where dateTime is a
 * naive (no offset) local time in `timeZone`. Accept the same `{dateTime}` shape
 * used by GoogleCalendarIntegrationAdapter (ISO string, usually UTC) and normalize it.
 */
function toGraphDateTime(value, fallbackTimeZone = "UTC") {
  if (!value) return null;
  const raw = typeof value === "string" ? value : (value.dateTime || value.date);
  if (!raw) return null;
  const timeZone = (value && typeof value === "object" && value.timeZone) ? safeString(value.timeZone) : fallbackTimeZone;
  const dateTime = safeString(raw).replace(/Z$/, "");
  return { dateTime, timeZone };
}

function extractOnlineMeetingUrl(event) {
  if (!event || typeof event !== "object") return null;
  return safeString(event.onlineMeeting?.joinUrl) || null;
}

/**
 * Outlook / Microsoft 365 calendar adapter — create/update approved appointments
 * via Microsoft Graph (no MSAL/SDK dependency; plain fetch).
 */
export class OutlookCalendarIntegrationAdapter extends IntegrationProvider {
  constructor({ fetchImpl = globalThis.fetch, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._fetch = fetchImpl;
    this._nowISO = String(nowISO);
  }

  get id() {
    return "outlook_calendar";
  }

  get displayName() {
    return "Outlook Calendar";
  }

  get supportedConnectionTypes() {
    return ["calendar"];
  }

  get supportedCapabilities() {
    return [
      INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT,
      INTEGRATION_CAPABILITIES.UPDATE_CALENDAR_EVENT,
      INTEGRATION_CAPABILITIES.DELETE_CALENDAR_EVENT,
      INTEGRATION_CAPABILITIES.LIST_CALENDAR_EVENTS,
      INTEGRATION_CAPABILITIES.READ_CALENDAR_AVAILABILITY,
    ];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Outlook Calendar",
      summary: "Create and update approved appointments on your Microsoft 365 / Outlook calendar.",
      estimatedTime: "5 minutes",
      prerequisites: ["Microsoft 365 or Outlook.com account with Calendar access"],
      steps: ["Click Connect with Microsoft", "Authorize calendar access", "Verify connection"],
      permissionsRequested: ["Calendars.ReadWrite", "User.Read", "offline_access"],
      verificationMethod: "OAuth token resolve + primary calendar events probe.",
      commonProblems: ["Missing Calendars.ReadWrite scope", "Refresh token not returned", "Tenant admin consent required"],
      reconnectInstructions: "Disconnect and reconnect Outlook Calendar.",
      documentationReference: "https://learn.microsoft.com/graph/api/user-post-events",
    });
  }

  async healthCheck() {
    return { status: isMicrosoftOAuthAppConfigured() ? "healthy" : "not_configured", providerId: this.id };
  }

  #creds({ connection, credentialResolver }) {
    if (!connection?.credentialReference || !credentialResolver) {
      throw new Error("Outlook Calendar credentials required.");
    }
    const resolved = credentialResolver.resolve(connection.credentialReference);
    const refreshToken = safeString(resolved.refreshToken || resolved.refresh_token);
    if (!refreshToken) throw new Error("Outlook Calendar refresh token missing.");
    return {
      refreshToken,
      accessToken: safeString(resolved.accessToken || resolved.access_token),
      senderEmail: safeString(resolved.senderEmail || resolved.metadata?.senderEmail),
    };
  }

  async verifyConnection({ connection, credentialResolver } = {}) {
    if (!connection?.credentialReference) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "missing_credentials",
        message: "Outlook Calendar credentials are required.",
      });
    }
    try {
      const creds = this.#creds({ connection, credentialResolver });
      const { res } = await callMicrosoftGraph({
        // Matches Calendars.ReadWrite scope — a small bounded events list, not calendars metadata.
        path: "/me/events?$top=1",
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        fetchImpl: this._fetch,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return deepFreeze({
          status: "failed",
          verifiedAt: this._nowISO,
          capabilitiesVerified: [],
          code: "verification_failed",
          message: safeString(data?.error?.message) || `Microsoft Graph probe failed (${res.status}).`,
        });
      }
      return deepFreeze({
        status: "success",
        verifiedAt: this._nowISO,
        capabilitiesVerified: this.supportedCapabilities,
        code: "verified",
        message: "Outlook Calendar connection verified.",
      });
    } catch (err) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "verification_failed",
        message: String(err?.message ?? err),
      });
    }
  }

  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    const capability = String(actionRequest?.capability ?? "");
    try {
      const creds = this.#creds({ connection, credentialResolver });
      const params = actionRequest?.parameters ?? {};

      if (capability === INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT) {
        const wantsTeams = Boolean(
          params.createTeamsMeeting
          || params.conferenceType === "teams"
          || params.conference === "teamsForBusiness",
        );
        const body = {
          subject: safeString(params.summary || params.title || "VIBETech appointment"),
          body: { contentType: "Text", content: safeString(params.description || params.body || "") },
          start: toGraphDateTime(params.start),
          end: toGraphDateTime(params.end),
        };
        const location = safeString(params.location || "");
        if (location) body.location = { displayName: location };
        if (Array.isArray(params.attendees)) {
          body.attendees = params.attendees
            .map((a) => ({
              emailAddress: {
                address: safeString(a?.email || a?.emailAddress?.address),
                name: safeString(a?.displayName || a?.emailAddress?.name || ""),
              },
              type: "required",
            }))
            .filter((a) => a.emailAddress.address);
        }
        if (wantsTeams) {
          body.isOnlineMeeting = true;
          body.onlineMeetingProvider = "teamsForBusiness";
        }
        // If a Zoom (or other) link was pasted, keep it visible for Outlook attendees.
        const conferenceUrl = safeString(params.conferenceUrl || params.zoomUrl || "");
        if (conferenceUrl && !wantsTeams) {
          body.body.content = [body.body.content, body.body.content ? "" : null, `Join: ${conferenceUrl}`]
            .filter((line) => line != null).join("\n").trim();
          if (!location) body.location = { displayName: conferenceUrl };
        }

        const { res, accessToken } = await callMicrosoftGraph({
          path: "/me/events",
          method: "POST",
          body,
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          fetchImpl: this._fetch,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(safeString(data?.error?.message) || `Graph event create failed (${res.status}).`);
        }
        const data = await res.json();
        void accessToken;
        const meetUrl = extractOnlineMeetingUrl(data);
        return deepFreeze({
          externalReference: safeString(data?.id),
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({
            htmlLink: data?.webLink ?? null,
            conferenceUrl: meetUrl || conferenceUrl || null,
            conferenceType: meetUrl ? "teams" : (conferenceUrl ? String(params.conferenceType || "zoom") : null),
          }),
        });
      }

      if (capability === INTEGRATION_CAPABILITIES.UPDATE_CALENDAR_EVENT) {
        const eventId = safeString(params.eventId);
        if (!eventId) {
          return deepFreeze({ status: "failed", error: "eventId_required", completedAt: this._nowISO });
        }
        const patch = {};
        if (params.summary || params.title) patch.subject = safeString(params.summary || params.title);
        if (params.description != null) patch.body = { contentType: "Text", content: safeString(params.description) };
        if (params.start) patch.start = toGraphDateTime(params.start);
        if (params.end) patch.end = toGraphDateTime(params.end);
        const { res } = await callMicrosoftGraph({
          path: `/me/events/${encodeURIComponent(eventId)}`,
          method: "PATCH",
          body: patch,
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          fetchImpl: this._fetch,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(safeString(data?.error?.message) || `Graph event update failed (${res.status}).`);
        }
        const data = await res.json();
        return deepFreeze({
          externalReference: safeString(data?.id || eventId),
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({ htmlLink: data?.webLink ?? null }),
        });
      }

      if (capability === INTEGRATION_CAPABILITIES.DELETE_CALENDAR_EVENT) {
        const eventId = safeString(params.eventId);
        if (!eventId) {
          return deepFreeze({ status: "failed", error: "eventId_required", completedAt: this._nowISO });
        }
        const { res } = await callMicrosoftGraph({
          path: `/me/events/${encodeURIComponent(eventId)}`,
          method: "DELETE",
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          fetchImpl: this._fetch,
        });
        if (!res.ok && res.status !== 404) {
          const data = await res.json().catch(() => ({}));
          throw new Error(safeString(data?.error?.message) || `Graph event delete failed (${res.status}).`);
        }
        return deepFreeze({
          externalReference: eventId,
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({ deleted: true }),
        });
      }

      if (capability === INTEGRATION_CAPABILITIES.LIST_CALENDAR_EVENTS) {
        const startDateTime = safeString(params.timeMin || new Date().toISOString());
        const endDateTime = safeString(params.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
        const query = new URLSearchParams({
          startDateTime,
          endDateTime,
          $orderby: "start/dateTime",
          $top: safeString(Number(params.maxResults) || 50),
        });
        const { res } = await callMicrosoftGraph({
          path: `/me/calendarView?${query.toString()}`,
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          fetchImpl: this._fetch,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(safeString(data?.error?.message) || `Graph calendarView failed (${res.status}).`);
        }
        const data = await res.json();
        const items = Array.isArray(data?.value) ? data.value : [];
        return deepFreeze({
          externalReference: `list_${this._nowISO}`,
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({
            events: items.map((ev) => ({
              id: safeString(ev.id),
              summary: safeString(ev.subject),
              description: safeString(ev.bodyPreview),
              start: ev.start?.dateTime || null,
              end: ev.end?.dateTime || null,
              htmlLink: ev.webLink ?? null,
              conferenceUrl: extractOnlineMeetingUrl(ev),
              conferenceType: extractOnlineMeetingUrl(ev) ? "teams" : null,
              location: safeString(ev.location?.displayName),
              source: "outlook_calendar",
            })),
          }),
        });
      }

      if (capability === INTEGRATION_CAPABILITIES.READ_CALENDAR_AVAILABILITY) {
        const schedules = Array.isArray(params.schedules) && params.schedules.length
          ? params.schedules.map(safeString)
          : [safeString(creds.senderEmail || "me")];
        const { res } = await callMicrosoftGraph({
          path: "/me/calendar/getSchedule",
          method: "POST",
          body: {
            schedules,
            startTime: toGraphDateTime(params.timeMin),
            endTime: toGraphDateTime(params.timeMax),
            availabilityViewInterval: 30,
          },
          accessToken: creds.accessToken,
          refreshToken: creds.refreshToken,
          fetchImpl: this._fetch,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(safeString(data?.error?.message) || `Graph getSchedule failed (${res.status}).`);
        }
        const data = await res.json();
        const calendars = {};
        for (const entry of Array.isArray(data?.value) ? data.value : []) {
          calendars[safeString(entry.scheduleId)] = {
            busy: (Array.isArray(entry.scheduleItems) ? entry.scheduleItems : []).map((item) => ({
              start: item.start?.dateTime || null,
              end: item.end?.dateTime || null,
            })),
          };
        }
        return deepFreeze({
          externalReference: `freebusy_${this._nowISO}`,
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({ calendars }),
        });
      }

      return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
    } catch (err) {
      return deepFreeze({
        status: "failed",
        error: String(err?.message ?? err),
        retryable: true,
        completedAt: this._nowISO,
      });
    }
  }
}
