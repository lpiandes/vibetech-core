function buildQuietHoursFromBusinessHours(businessHours) {
  const bh = businessHours && typeof businessHours === "object" ? businessHours : null;
  if (!bh) return { start: "19:00", end: "08:00" };

  const end = String(bh.end ?? "").trim();
  // If we can't parse, fall back to safe defaults.
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return { start: "19:00", end: "08:00" };

  // Quiet hours start 2 hours after business end (mod 24), end at 08:00.
  const [hh, mm] = end.split(":").map((x) => Number(x));
  const startHour = (hh + 2) % 24;
  const pad = (n) => (n < 10 ? `0${n}` : String(n));
  return { start: `${pad(startHour)}:${mm < 10 ? `0${mm}` : String(mm)}`, end: "08:00" };
}

export function createCommunicationSetupDefaults({ businessHours, timeZone } = {}) {
  const quiet = buildQuietHoursFromBusinessHours(businessHours);
  return Object.freeze({
    defaultTone: "Professional",
    defaultLanguage: "",
    quietHours: {
      timeZone: String(timeZone ?? ""),
      start: quiet.start,
      end: quiet.end,
    },
    preferredChannels: ["EMAIL"],
  });
}

