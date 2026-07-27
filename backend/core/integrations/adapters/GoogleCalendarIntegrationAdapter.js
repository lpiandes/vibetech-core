import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createGoogleAuthedClient, isGoogleOAuthAppConfigured } from "../oauth/GoogleOAuthClient.js";
import { google } from "googleapis";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function extractConferenceUrl(event) {
  if (!event || typeof event !== "object") return null;
  if (event.hangoutLink) return safeString(event.hangoutLink);
  const entries = event.conferenceData?.entryPoints;
  if (Array.isArray(entries)) {
    const video = entries.find((e) => String(e?.entryPointType) === "video" && e?.uri);
    if (video?.uri) return safeString(video.uri);
    const any = entries.find((e) => e?.uri);
    if (any?.uri) return safeString(any.uri);
  }
  return null;
}

/**
 * Google Calendar integration — create/update events after owner approval.
 */
export class GoogleCalendarIntegrationAdapter extends IntegrationProvider {
  constructor({ calendarClient = null, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._calendarClient = calendarClient;
    this._nowISO = String(nowISO);
  }

  get id() {
    return "google_calendar";
  }

  get displayName() {
    return "Google Calendar";
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
      title: "Connect Google Calendar",
      summary: "Create and update approved appointments on your Google Calendar.",
      estimatedTime: "5 minutes",
      prerequisites: ["Google account with Calendar access"],
      steps: ["Click Connect with Google", "Authorize calendar access", "Verify connection"],
      permissionsRequested: ["calendar.events"],
      verificationMethod: "OAuth token resolve + primary calendar events probe.",
      commonProblems: ["Missing calendar.events scope", "Refresh token not returned", "User skipped calendar permission checkbox"],
      reconnectInstructions: "Disconnect and reconnect Google Calendar.",
      documentationReference: "https://developers.google.com/calendar/api",
    });
  }

  async healthCheck() {
    return {
      status: this._calendarClient || isGoogleOAuthAppConfigured() ? "healthy" : "not_configured",
      providerId: this.id,
    };
  }

  #clientFor({ connection, credentialResolver }) {
    if (this._calendarClient) return this._calendarClient;
    if (!connection?.credentialReference || !credentialResolver) {
      throw new Error("Google Calendar credentials required.");
    }
    const resolved = credentialResolver.resolve(connection.credentialReference);
    const refreshToken = resolved.refreshToken || resolved.refresh_token;
    if (!refreshToken) throw new Error("Google Calendar refresh token missing.");
    const auth = createGoogleAuthedClient({
      refreshToken,
      accessToken: resolved.accessToken || resolved.access_token || null,
    });
    return google.calendar({ version: "v3", auth });
  }

  async verifyConnection({ connection, credentialResolver } = {}) {
    if (!connection?.credentialReference) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "missing_credentials",
        message: "Google Calendar credentials are required.",
      });
    }
    try {
      const client = this.#clientFor({ connection, credentialResolver });
      // Use events.list — matches calendar.events OAuth scope (calendarList requires broader access).
      if (client.events?.list) {
        await client.events.list({
          calendarId: "primary",
          maxResults: 1,
          singleEvents: true,
          orderBy: "startTime",
          timeMin: new Date().toISOString(),
        });
      } else if (client.calendarList?.list) {
        await client.calendarList.list({ maxResults: 1 });
      }
      return deepFreeze({
        status: "success",
        verifiedAt: this._nowISO,
        capabilitiesVerified: this.supportedCapabilities,
        code: "verified",
        message: "Google Calendar connection verified.",
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
      const client = this.#clientFor({ connection, credentialResolver });
      const params = actionRequest?.parameters ?? {};

      if (capability === INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT) {
        const wantsMeet = Boolean(
          params.createGoogleMeet
          || params.conferenceType === "google_meet"
          || params.conference === "hangoutsMeet",
        );
        const requestBody = {
          summary: safeString(params.summary || params.title || "VIBETech appointment"),
          description: safeString(params.description || params.body || ""),
          location: safeString(params.location || ""),
          start: params.start,
          end: params.end,
          attendees: Array.isArray(params.attendees) ? params.attendees : undefined,
        };
        if (wantsMeet) {
          requestBody.conferenceData = {
            createRequest: {
              requestId: `vt_meet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          };
        }
        // If a Zoom (or other) link was pasted, keep it on the event for Google Calendar attendees.
        const conferenceUrl = safeString(params.conferenceUrl || params.zoomUrl || "");
        if (conferenceUrl && !wantsMeet) {
          requestBody.description = [
            requestBody.description,
            requestBody.description ? "" : null,
            `Join: ${conferenceUrl}`,
          ].filter((line) => line != null).join("\n").trim();
          requestBody.location = requestBody.location || conferenceUrl;
        }

        const res = await client.events.insert({
          calendarId: safeString(params.calendarId || "primary"),
          conferenceDataVersion: wantsMeet ? 1 : 0,
          requestBody,
        });
        const meetUrl = extractConferenceUrl(res?.data);
        return deepFreeze({
          externalReference: safeString(res?.data?.id),
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({
            htmlLink: res?.data?.htmlLink ?? null,
            conferenceUrl: meetUrl || conferenceUrl || null,
            conferenceType: meetUrl ? "google_meet" : (conferenceUrl ? String(params.conferenceType || "zoom") : null),
            hangoutLink: res?.data?.hangoutLink ?? null,
          }),
        });
      }

      if (capability === INTEGRATION_CAPABILITIES.UPDATE_CALENDAR_EVENT) {
        const eventId = safeString(params.eventId);
        if (!eventId) {
          return deepFreeze({ status: "failed", error: "eventId_required", completedAt: this._nowISO });
        }
        const res = await client.events.patch({
          calendarId: safeString(params.calendarId || "primary"),
          eventId,
          requestBody: {
            summary: params.summary ?? params.title,
            description: params.description,
            start: params.start,
            end: params.end,
            attendees: params.attendees,
          },
        });
        return deepFreeze({
          externalReference: safeString(res?.data?.id || eventId),
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({ htmlLink: res?.data?.htmlLink ?? null }),
        });
      }

      if (capability === INTEGRATION_CAPABILITIES.DELETE_CALENDAR_EVENT) {
        const eventId = safeString(params.eventId);
        if (!eventId) {
          return deepFreeze({ status: "failed", error: "eventId_required", completedAt: this._nowISO });
        }
        await client.events.delete({
          calendarId: safeString(params.calendarId || "primary"),
          eventId,
        });
        return deepFreeze({
          externalReference: eventId,
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({ deleted: true }),
        });
      }

      if (capability === INTEGRATION_CAPABILITIES.LIST_CALENDAR_EVENTS) {
        const res = await client.events.list({
          calendarId: safeString(params.calendarId || "primary"),
          timeMin: params.timeMin || new Date().toISOString(),
          timeMax: params.timeMax || undefined,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: Number(params.maxResults) || 50,
        });
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        return deepFreeze({
          externalReference: `list_${this._nowISO}`,
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({
            events: items.map((ev) => ({
              id: safeString(ev.id),
              summary: safeString(ev.summary),
              description: safeString(ev.description),
              start: ev.start?.dateTime || ev.start?.date || null,
              end: ev.end?.dateTime || ev.end?.date || null,
              htmlLink: ev.htmlLink ?? null,
              conferenceUrl: extractConferenceUrl(ev),
              conferenceType: extractConferenceUrl(ev) ? "google_meet" : null,
              location: safeString(ev.location),
              source: "google_calendar",
            })),
          }),
        });
      }

      if (capability === INTEGRATION_CAPABILITIES.READ_CALENDAR_AVAILABILITY) {
        const res = await client.freebusy.query({
          requestBody: {
            timeMin: params.timeMin,
            timeMax: params.timeMax,
            items: [{ id: safeString(params.calendarId || "primary") }],
          },
        });
        return deepFreeze({
          externalReference: `freebusy_${this._nowISO}`,
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({ calendars: res?.data?.calendars ?? {} }),
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
