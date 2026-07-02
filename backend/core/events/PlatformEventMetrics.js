function parseISO(value, name) {
  if (!value || typeof value !== "string") throw new Error(`PlatformEventMetrics: ${name} required ISO string.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`PlatformEventMetrics: ${name} invalid ISO string.`);
  return ms;
}

export function computePlatformEventMetrics(events = []) {
  const safe = Array.isArray(events) ? events : [];

  const eventsByType = {};
  const eventsByPublisher = {};
  const eventsByAggregate = {};

  let latestOccurredAtISO = null;
  let latestMs = -Infinity;

  for (const e of safe) {
    const t = String(e.eventType);
    eventsByType[t] = (eventsByType[t] ?? 0) + 1;

    const pub = String(e.publisher);
    eventsByPublisher[pub] = (eventsByPublisher[pub] ?? 0) + 1;

    const agg = String(e.aggregateId);
    eventsByAggregate[agg] = (eventsByAggregate[agg] ?? 0) + 1;

    const ms = parseISO(String(e.occurredAt), "event.occurredAt");
    if (ms > latestMs) {
      latestMs = ms;
      latestOccurredAtISO = String(e.occurredAt);
    }
  }

  return deepFreeze({
    totalEvents: safe.length,
    eventsByType,
    eventsByPublisher,
    eventsByAggregate,
    latestEventTimestamp: latestOccurredAtISO,
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

