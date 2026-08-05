---
name: RFT Min Integrations
overview: Deepen the minimum Revenue Follow-Through integration set so each connection supports auth, events, read/write, health, idempotency, delivery proof, and a real prove flow.
todos:
  - id: integ-audit
    content: Audit Gmail/Calendar/forms/HubSpot/Twilio prove + event gaps vs RFT event catalog
    status: completed
  - id: integ-prove-rft
    content: Wire prove flows to attach provider IDs onto RFT opportunity evidence
    status: completed
  - id: integ-inbound-events
    content: Normalize inbound events into RFT/specialty triggers for priority channels
    status: completed
  - id: integ-tests
    content: Tests for capability ladder + prove→Verified evidence attachment
    status: completed
isProject: false
---

# Plan 5: Minimum RFT integration set

**Status:** DONE (2026-08-05)

## Goal
For Managed Revenue Follow-Through, prioritize depth on the channels that detect opportunities and prove work — not twenty shallow connectors.

## Priority stack
1. Gmail (strengthen prove + inbound events) — **shipped**
2. Outlook email — deferred (Google path green first)
3. Google Calendar / Microsoft Calendar — Google prove → RFT evidence **shipped**; Microsoft deferred
4. Website forms / webhooks — prove + specialty emit **shipped**
5. HubSpot — evidence kind in RFT catalog; live CRM prove connector deferred (not required for beachhead Verified path)
6. HighLevel — deferred
7. Twilio phone / SMS — SMS prove → RFT evidence **shipped**

## Shipped
- `attachProveEvidenceToRft.js` — prove actions → provider evidence → Verified
- Prove API hooks RFT attach after live prove / owner receipt confirm
- Gmail inbound sync emits `INBOUND_SALES_EMAIL` (manual sync, OAuth first sync, hosted tick)
- Tests: prove→Verified + Gmail `onNewInbound`

## Ships when (acceptance met)
An opportunity can be detected from a connected channel and reach Verified with provider-backed evidence for email + one lead source (forms) + calendar or SMS.

## Depends on
Plans 1–2.

## Unblocks
Plans 6–7 (observation needs history; launch prove needs channels).
