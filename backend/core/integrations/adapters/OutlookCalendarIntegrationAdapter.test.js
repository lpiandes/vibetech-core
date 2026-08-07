import test from "node:test";
import assert from "node:assert/strict";

import { OutlookCalendarIntegrationAdapter } from "./OutlookCalendarIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";

const NOW = "2026-08-01T00:00:00.000Z";

function connectionWith() {
  return { credentialReference: { credentialId: "cred_outlook_cal_1" } };
}

function resolverWith(creds) {
  return { resolve: () => creds };
}

test("Outlook calendar adapter declares full calendar capability parity with Google Calendar", () => {
  const adapter = new OutlookCalendarIntegrationAdapter({ nowISO: NOW });
  assert.equal(adapter.id, "outlook_calendar");
  assert.deepEqual(adapter.supportedConnectionTypes, ["calendar"]);
  assert.deepEqual(
    [...adapter.supportedCapabilities].sort(),
    [
      INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT,
      INTEGRATION_CAPABILITIES.DELETE_CALENDAR_EVENT,
      INTEGRATION_CAPABILITIES.LIST_CALENDAR_EVENTS,
      INTEGRATION_CAPABILITIES.READ_CALENDAR_AVAILABILITY,
      INTEGRATION_CAPABILITIES.UPDATE_CALENDAR_EVENT,
    ].sort(),
  );
});

test("Outlook calendar create posts to /me/events and returns the Graph event id", async () => {
  let captured = null;
  const fetchImpl = async (url, init) => {
    if (String(url).endsWith("/me/events")) {
      captured = JSON.parse(init.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: "AAMk_graph_event_1",
          webLink: "https://outlook.office.com/calendar/item/AAMk_graph_event_1",
        }),
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const adapter = new OutlookCalendarIntegrationAdapter({ nowISO: NOW, fetchImpl });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT,
      parameters: {
        summary: "VIBETech prove test",
        description: "Design-partner calendar prove — safe to delete.",
        start: { dateTime: "2026-08-01T14:00:00.000Z" },
        end: { dateTime: "2026-08-01T14:30:00.000Z" },
      },
    },
    connection: connectionWith(),
    credentialResolver: resolverWith({ refreshToken: "rt_1", accessToken: "at_1" }),
  });

  assert.equal(result.status, "completed");
  assert.equal(result.externalReference, "AAMk_graph_event_1");
  assert.equal(result.metadata.htmlLink, "https://outlook.office.com/calendar/item/AAMk_graph_event_1");
  assert.equal(captured.subject, "VIBETech prove test");
  assert.equal(captured.start.dateTime, "2026-08-01T14:00:00.000");
  assert.equal(captured.start.timeZone, "UTC");
});

test("Outlook calendar create requests a Teams meeting when createTeamsMeeting is set", async () => {
  let captured = null;
  const fetchImpl = async (url, init) => {
    captured = JSON.parse(init.body);
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: "evt_teams_1",
        onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/abc" },
      }),
    };
  };

  const adapter = new OutlookCalendarIntegrationAdapter({ nowISO: NOW, fetchImpl });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT,
      parameters: {
        summary: "Teams call",
        start: { dateTime: "2026-08-01T14:00:00.000Z" },
        end: { dateTime: "2026-08-01T14:30:00.000Z" },
        createTeamsMeeting: true,
      },
    },
    connection: connectionWith(),
    credentialResolver: resolverWith({ refreshToken: "rt_1", accessToken: "at_1" }),
  });

  assert.equal(captured.isOnlineMeeting, true);
  assert.equal(captured.onlineMeetingProvider, "teamsForBusiness");
  assert.equal(result.metadata.conferenceUrl, "https://teams.microsoft.com/l/meetup-join/abc");
  assert.equal(result.metadata.conferenceType, "teams");
});

test("Outlook calendar create surfaces a Graph error message on failure", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ error: { message: "Insufficient privileges to complete the operation." } }),
  });
  const adapter = new OutlookCalendarIntegrationAdapter({ nowISO: NOW, fetchImpl });
  const result = await adapter.executeAction({
    actionRequest: {
      capability: INTEGRATION_CAPABILITIES.CREATE_CALENDAR_EVENT,
      parameters: { summary: "x", start: { dateTime: "2026-08-01T14:00:00.000Z" }, end: { dateTime: "2026-08-01T14:30:00.000Z" } },
    },
    connection: connectionWith(),
    credentialResolver: resolverWith({ refreshToken: "rt_1", accessToken: "at_1" }),
  });
  assert.equal(result.status, "failed");
  assert.match(result.error, /Insufficient privileges/);
});

test("Outlook calendar delete tolerates a 404 (already deleted) as success", async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const adapter = new OutlookCalendarIntegrationAdapter({ nowISO: NOW, fetchImpl });
  const result = await adapter.executeAction({
    actionRequest: { capability: INTEGRATION_CAPABILITIES.DELETE_CALENDAR_EVENT, parameters: { eventId: "evt_1" } },
    connection: connectionWith(),
    credentialResolver: resolverWith({ refreshToken: "rt_1", accessToken: "at_1" }),
  });
  assert.equal(result.status, "completed");
  assert.equal(result.metadata.deleted, true);
});

test("Outlook calendar list maps calendarView events into a normalized shape", async () => {
  const fetchImpl = async (url) => {
    assert.match(String(url), /\/me\/calendarView\?/);
    return {
      ok: true,
      json: async () => ({
        value: [
          {
            id: "evt_1",
            subject: "Consult",
            start: { dateTime: "2026-08-02T10:00:00.000" },
            end: { dateTime: "2026-08-02T10:30:00.000" },
            webLink: "https://outlook.office.com/x",
          },
        ],
      }),
    };
  };
  const adapter = new OutlookCalendarIntegrationAdapter({ nowISO: NOW, fetchImpl });
  const result = await adapter.executeAction({
    actionRequest: { capability: INTEGRATION_CAPABILITIES.LIST_CALENDAR_EVENTS, parameters: {} },
    connection: connectionWith(),
    credentialResolver: resolverWith({ refreshToken: "rt_1", accessToken: "at_1" }),
  });
  assert.equal(result.status, "completed");
  assert.equal(result.metadata.events.length, 1);
  assert.equal(result.metadata.events[0].summary, "Consult");
  assert.equal(result.metadata.events[0].source, "outlook_calendar");
});

test("Outlook calendar verifyConnection fails without a connection", async () => {
  const adapter = new OutlookCalendarIntegrationAdapter({ nowISO: NOW });
  const result = await adapter.verifyConnection({ connection: null, credentialResolver: null });
  assert.equal(result.status, "failed");
  assert.equal(result.code, "missing_credentials");
});
