function parseISO(value, name) {
  if (!value || typeof value !== "string") throw new Error(`RequestMetrics: expected ${name} ISO string.`);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`RequestMetrics: ${name} must be valid ISO timestamp.`);
  return ms;
}

export function computeRequestMetrics({ requests, nowISO } = {}) {
  const safeRequests = Array.isArray(requests) ? requests : [];
  const now = parseISO(String(nowISO), "nowISO");

  const totalRequests = safeRequests.length;
  const newRequests = safeRequests.filter((r) => String(r.status) === "received").length;
  const qualifiedRequests = safeRequests.filter((r) => String(r.status) === "qualified").length;
  const convertedRequests = safeRequests.filter((r) => String(r.status) === "converted").length;
  const closedRequests = safeRequests.filter((r) => String(r.status) === "closed").length;

  const averageAgeMs =
    totalRequests === 0
      ? 0
      : safeRequests.reduce((acc, r) => {
          const received = parseISO(String(r.receivedAt), "request.receivedAt");
          return acc + (now - received);
        }, 0) / totalRequests;

  return {
    totalRequests,
    newRequests,
    qualifiedRequests,
    convertedRequests,
    closedRequests,
    averageAgeMs,
  };
}

