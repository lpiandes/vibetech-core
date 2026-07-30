/**
 * Best-effort: fetch Google Calendar busy intervals so offered/booked slots
 * don't collide with existing events. Shared by the SMS inbound webhook and
 * the public booking API.
 */
import { GoogleCalendarIntegrationAdapter } from "../adapters/GoogleCalendarIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { findCalendarConnection } from "./bookConfirmedAppointment.js";

/**
 * @param {object} workspace - workspace service (as returned by getSystemWorkspaceForBusiness)
 * @param {string} timeMinISO
 * @param {string} timeMaxISO
 * @returns {Promise<Array<{start: string, end: string}>>}
 */
export async function fetchCalendarBusyIntervals(workspace, timeMinISO, timeMaxISO) {
  try {
    const { hub, connection } = findCalendarConnection(workspace);
    if (!connection || !hub?.credentialResolver) return [];
    const calendar = new GoogleCalendarIntegrationAdapter();
    const result = await calendar.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.READ_CALENDAR_AVAILABILITY,
        parameters: { timeMin: timeMinISO, timeMax: timeMaxISO, calendarId: "primary" },
      },
      connection,
      credentialResolver: hub.credentialResolver,
    });
    const busy = result?.metadata?.calendars?.primary?.busy;
    return Array.isArray(busy) ? busy.map((b) => ({ start: b.start, end: b.end })) : [];
  } catch {
    return [];
  }
}
