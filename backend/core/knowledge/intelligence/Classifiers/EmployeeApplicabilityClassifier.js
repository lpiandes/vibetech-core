import {
  CAPABILITY_HINTS_BY_BUSINESS_AREA,
  CAPABILITY_HINTS_BY_DOCUMENT_TYPE,
} from "../mappings/employeeApplicabilityMappings.js";

function normalizeToken(s) {
  return String(s ?? "").trim().toLowerCase();
}

function normalizeForMatch(s) {
  // "customer support" and "CustomerSupport" should match.
  return normalizeToken(s).replace(/[^a-z0-9]+/g, "");
}

function uniquePreserveOrder(arr) {
  const out = [];
  const seen = new Set();
  for (const a of arr) {
    const key = String(a ?? "");
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

function scoreEmployeeMatch({ employee, candidateTokens } = {}) {
  const caps = Array.isArray(employee?.capabilities) ? employee.capabilities : [];
  const capNormalized = caps.map(normalizeForMatch);

  let score = 0;
  const reasons = [];

  for (const token of candidateTokens) {
    const t = normalizeForMatch(token?.value);
    if (!t) continue;

    if (capNormalized.some((c) => c.includes(t) || t.includes(c))) {
      score += token.type === "tag" ? 3 : 2;
      reasons.push(`matched:${token.type}:${normalizeToken(token.value)}`);
    }
  }

  return { score, reasons };
}

export class EmployeeApplicabilityClassifier {
  classify({
    runtime,
    categoryId,
    suggestedTags,
    businessAreas,
    documentType,
  } = {}) {
    const employees = runtime?.getEmployees?.() ?? [];
    const employeeSignals = [];

    for (const e of employees) {
      const tagTokens = uniquePreserveOrder(suggestedTags ?? []).map((value) => ({
        type: "tag",
        value,
      }));

      const areaHintTokens = uniquePreserveOrder(businessAreas ?? []).flatMap((area) => {
        const hints = CAPABILITY_HINTS_BY_BUSINESS_AREA[area] ?? [];
        return uniquePreserveOrder(hints).map((value) => ({ type: "area", value }));
      });

      const docHintTokens = uniquePreserveOrder([categoryId, documentType].filter(Boolean)).flatMap(
        (docTypeLike) => {
          const hints = CAPABILITY_HINTS_BY_DOCUMENT_TYPE[docTypeLike] ?? [];
          return uniquePreserveOrder(hints).map((value) => ({ type: "doc", value }));
        },
      );

      const candidateTokens = uniquePreserveOrder([
        ...tagTokens.map((x) => `${x.type}:${x.value}`),
        ...areaHintTokens.map((x) => `${x.type}:${x.value}`),
        ...docHintTokens.map((x) => `${x.type}:${x.value}`),
      ]).map((typed) => {
        const [type, ...rest] = typed.split(":");
        return { type, value: rest.join(":") };
      });

      const match = scoreEmployeeMatch({
        employee: e,
        candidateTokens,
      });
      employeeSignals.push({
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        status: e.status,
        score: match.score,
        reasons: match.reasons,
      });
    }

    employeeSignals.sort(
      (a, b) => b.score - a.score || String(a.employeeId).localeCompare(String(b.employeeId)),
    );

    const suggestedEmployees = employeeSignals
      .filter((s) => s.score > 0)
      .slice(0, 3)
      .map((s) => ({
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        matchReasonTokens: s.reasons.slice(0, 6),
        matchScore: s.score,
      }));

    return { suggestedEmployees, employeeSignals };
  }
}

