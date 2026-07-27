/**
 * LLM analysis of public social evidence with protected-characteristic filter.
 */
import { createLlmProvider } from "../../providers/createLlmProvider.js";

const FILTER_RULES = [
  "Do NOT include or infer race, color, religion, national origin, sex, sexual orientation,",
  "gender identity, pregnancy, age (as a protected class), disability, genetic information,",
  "or marital status. If source text mentions these, omit them and note filterApplied.",
  "Focus on publicly observable workplace-relevant conduct themes only:",
  "violence/threats, illegal activity claims, harassment, extreme workplace hostility,",
  "clear professional misrepresentation — each with evidence URL and short quote.",
  "Never recommend hire/no-hire. Never invent posts that are not in the evidence.",
].join(" ");

/**
 * @returns {Promise<object>} structured report
 */
export async function analyzeSocialScreenReport({
  subject = {},
  profiles = [],
  pages = [],
  llmProvider = null,
} = {}) {
  const provider = llmProvider || createLlmProvider({ preferLive: true });
  const evidence = {
    subject: {
      name: String(subject.name ?? ""),
      email: String(subject.email ?? ""),
      handles: Array.isArray(subject.handles) ? subject.handles.map(String) : [],
      location: String(subject.location ?? ""),
    },
    profiles: (Array.isArray(profiles) ? profiles : []).slice(0, 20).map((p) => ({
      network: p.network,
      title: p.title,
      url: p.url,
      snippet: String(p.snippet ?? "").slice(0, 400),
    })),
    pages: (Array.isArray(pages) ? pages : [])
      .filter((p) => p?.ok && p.text)
      .slice(0, 8)
      .map((p) => ({
        url: p.url,
        text: String(p.text).slice(0, 3500),
      })),
  };

  const prompt = [
    "You produce an employment social-media background screening report from PUBLIC web evidence.",
    FILTER_RULES,
    "Return JSON with keys:",
    "subjectName (string), summary (string), profilesFound (array of {network,url,title}),",
    "findings (array of {theme, severity: low|medium|high, evidenceUrl, quote, note}),",
    "filterNotes (string[]), confidence (0-1), disclaimer (string).",
    "If little evidence, say so and return empty findings.",
    "",
    `EVIDENCE_JSON:\n${JSON.stringify(evidence)}`,
  ].join("\n");

  let raw = "";
  try {
    raw = await provider.generate(prompt, { json: true, temperature: 0.1 });
  } catch {
    raw = "";
  }

  const parsed = parseJson(raw);
  if (parsed) {
    return normalizeReport(parsed, evidence);
  }

  // Deterministic fallback when LLM unavailable
  return normalizeReport({
    subjectName: evidence.subject.name,
    summary: evidence.profiles.length
      ? `Found ${evidence.profiles.length} public profile candidates. Manual review required; LLM analysis unavailable.`
      : "No public social profiles discovered for this subject.",
    profilesFound: evidence.profiles.map((p) => ({
      network: p.network,
      url: p.url,
      title: p.title,
    })),
    findings: [],
    filterNotes: ["Protected-characteristic filter applied.", "LLM analysis unavailable — evidence listed only."],
    confidence: evidence.profiles.length ? 0.3 : 0.1,
    disclaimer: "Public-web screening tool only. Employer remains responsible for FCRA compliance. Not a licensed CRA substitute.",
  }, evidence);
}

function parseJson(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeReport(parsed, evidence) {
  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
  return {
    subjectName: String(parsed.subjectName ?? evidence.subject.name ?? ""),
    summary: String(parsed.summary ?? "").trim(),
    profilesFound: Array.isArray(parsed.profilesFound)
      ? parsed.profilesFound
      : evidence.profiles.map((p) => ({ network: p.network, url: p.url, title: p.title })),
    findings: findings.map((f) => ({
      theme: String(f.theme ?? "note"),
      severity: ["low", "medium", "high"].includes(String(f.severity).toLowerCase())
        ? String(f.severity).toLowerCase()
        : "low",
      evidenceUrl: String(f.evidenceUrl ?? ""),
      quote: String(f.quote ?? "").slice(0, 280),
      note: String(f.note ?? ""),
    })),
    filterNotes: Array.isArray(parsed.filterNotes)
      ? parsed.filterNotes.map(String)
      : ["Protected-characteristic filter applied."],
    confidence: Number.isFinite(Number(parsed.confidence))
      ? Math.max(0, Math.min(1, Number(parsed.confidence)))
      : 0.4,
    disclaimer: String(parsed.disclaimer
      ?? "Public-web screening tool only. Employer remains responsible for FCRA compliance. Not a licensed CRA substitute."),
    generatedAt: new Date().toISOString(),
  };
}

export function formatSocialScreenReportBody(report = {}) {
  const lines = [
    `# Social background screening report`,
    ``,
    `**Subject:** ${report.subjectName || "Unknown"}`,
    `**Confidence:** ${Math.round((Number(report.confidence) || 0) * 100)}%`,
    ``,
    report.summary || "",
    ``,
    `## Profiles found`,
  ];
  for (const p of Array.isArray(report.profilesFound) ? report.profilesFound : []) {
    lines.push(`- [${p.network}] ${p.title || p.url} — ${p.url}`);
  }
  if (!report.profilesFound?.length) lines.push("- None");
  lines.push(``, `## Findings`);
  for (const f of Array.isArray(report.findings) ? report.findings : []) {
    lines.push(`- **${f.severity}** ${f.theme}: ${f.quote || f.note} (${f.evidenceUrl || "no url"})`);
  }
  if (!report.findings?.length) lines.push("- No workplace-relevant findings extracted.");
  lines.push(``, `## Filter notes`);
  for (const n of Array.isArray(report.filterNotes) ? report.filterNotes : []) {
    lines.push(`- ${n}`);
  }
  lines.push(``, `## Disclaimer`, report.disclaimer || "");
  return lines.join("\n");
}
