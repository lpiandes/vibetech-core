import test from "node:test";
import assert from "node:assert/strict";
import { buildFirstTouchSms, runSmsAppointmentSetterTurn, formatSlotsForSms } from "./smsAppointmentSetter.js";
import { normalizePhone } from "./AppointmentSetterSessionStore.js";

test("first touch offers booking and opt-out", () => {
  assert.match(buildFirstTouchSms({ businessName: "Acme", name: "Lee", bookingUrl: "https://example.test/book" }), /Lee/);
  assert.match(buildFirstTouchSms({ bookingUrl: "https://example.test/book" }), /STOP/i);
});

test("formatSlotsForSms handles both slot objects and plain strings", () => {
  const objects = formatSlotsForSms([
    { label: "Mon Aug 3 at 9:00 AM" },
    { label: "Mon Aug 3 at 9:30 AM" },
  ]);
  assert.equal(objects, "1) Mon Aug 3 at 9:00 AM, 2) Mon Aug 3 at 9:30 AM");
  const strings = formatSlotsForSms(["Tue at 10 AM", "Tue at 2 PM"]);
  assert.equal(strings, "1) Tue at 10 AM, 2) Tue at 2 PM");
});

test("qualify to offer to confirm to booked flow (confirmed booking language, not hold)", async () => {
  const qualify = await runSmsAppointmentSetterTurn({ inboundText: "I need coverage help", session: { stage: "qualify" }, bookingUrl: "https://example.test/book" });
  assert.equal(qualify.sessionPatch.stage, "offer");
  const offer = await runSmsAppointmentSetterTurn({ inboundText: "2", session: { ...qualify.sessionPatch }, bookingUrl: "https://example.test/book" });
  assert.equal(offer.sessionPatch.stage, "confirm");
  assert.match(offer.reply, /book you for/i);
  const confirm = await runSmsAppointmentSetterTurn({ inboundText: "yes", session: { ...offer.sessionPatch }, bookingUrl: "https://example.test/book" });
  assert.equal(confirm.intent, "book");
  assert.ok(confirm.bookSlot);
  assert.match(confirm.reply, /booked/i);
  assert.doesNotMatch(confirm.reply, /hold/i);
  assert.doesNotMatch(confirm.reply, /will confirm/i);

  const alreadyBooked = await runSmsAppointmentSetterTurn({ inboundText: "hi", session: { stage: "booked" }, businessName: "Acme" });
  assert.match(alreadyBooked.reply, /all set/i);
  assert.doesNotMatch(alreadyBooked.reply, /hold/i);
});

test("supports rich slot objects (from resolveAvailabilitySlots) as offeredSlots", async () => {
  const slotObjects = [
    { id: "slot_1", startISO: "2026-08-03T13:00:00.000Z", endISO: "2026-08-03T13:30:00.000Z", label: "Mon Aug 3 at 9:00 AM", memberId: "user_1", memberName: "Jordan" },
    { id: "slot_2", startISO: "2026-08-03T13:30:00.000Z", endISO: "2026-08-03T14:00:00.000Z", label: "Mon Aug 3 at 9:30 AM", memberId: "user_1", memberName: "Jordan" },
  ];
  const offer = await runSmsAppointmentSetterTurn({
    inboundText: "1",
    session: { stage: "offer", offeredSlots: slotObjects },
    bookingUrl: "https://example.test/book",
  });
  assert.equal(offer.sessionPatch.stage, "confirm");
  assert.deepEqual(offer.sessionPatch.selectedSlot, slotObjects[0]);
  assert.match(offer.reply, /Mon Aug 3 at 9:00 AM/);

  const confirm = await runSmsAppointmentSetterTurn({
    inboundText: "yes",
    session: { ...offer.sessionPatch },
    bookingUrl: "https://example.test/book",
  });
  assert.deepEqual(confirm.bookSlot, slotObjects[0], "bookSlot should be the full slot object, not just a label");
});

test("STOP closes outreach and phone normalizes", async () => {
  const stopped = await runSmsAppointmentSetterTurn({ inboundText: "STOP", session: { stage: "offer" } });
  assert.equal(stopped.sessionPatch.stage, "closed");
  assert.equal(normalizePhone("(555) 123-4567"), "+15551234567");
});
