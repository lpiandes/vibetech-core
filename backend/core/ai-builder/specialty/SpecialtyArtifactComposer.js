import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { extractActivitiesFromSources } from "./consultSpecialtySources.js";
import { MISSING_CURRICULUM_GAP } from "./SpecialtyAuthorityRegistry.js";

/**
 * Registered specialty deliverable templates.
 * Layouts are universal; vocabulary packs adapt labels per domain without codegen.
 * Activity content always comes from consulted sources — never invented catalogs.
 */
export const SPECIALTY_ARTIFACT_TEMPLATES = Object.freeze({
  session_flow: Object.freeze({
    id: "session_flow",
    label: "Session flow",
    layout: "timeline",
    matchKeywords: [
      "practice", "workout", "training", "session", "class", "lesson", "rehearsal",
      "drill", "clinic", "appointment block", "shift plan", "day plan",
    ],
    defaultDurationMins: 60,
  }),
  station_board: Object.freeze({
    id: "station_board",
    label: "Station board",
    layout: "station_board",
    matchKeywords: [
      "stations", "rotations", "circuit", "rooms", "lanes", "booths", "pods",
    ],
    defaultDurationMins: 45,
  }),
  checklist_run: Object.freeze({
    id: "checklist_run",
    label: "Checklist run",
    layout: "sequence",
    matchKeywords: [
      "checklist", "inspection", "audit", "walkthrough", "punch list", "closing list",
      "opening checklist", "compliance",
    ],
    defaultDurationMins: null,
  }),
  outreach_sequence: Object.freeze({
    id: "outreach_sequence",
    label: "Outreach sequence",
    layout: "sequence",
    matchKeywords: [
      "outreach", "follow-up sequence", "cadence", "nurture", "drip", "campaign steps",
    ],
    defaultDurationMins: null,
  }),
  structured_brief: Object.freeze({
    id: "structured_brief",
    label: "Structured brief",
    layout: "cards",
    matchKeywords: [],
    defaultDurationMins: null,
  }),
});

/** Vocabulary packs: phase labels / layout only — not activity content authority. */
export const SPECIALTY_VOCABULARY_PACKS = Object.freeze([
  Object.freeze({
    id: "athletic_session",
    matchKeywords: ["practice", "workout", "drill", "skating", "training", "ice", "field", "hockey", "soccer", "basketball"],
    sessionPhases: [
      { key: "open", label: "Warm-up", intent: "Get bodies and brains ready" },
      { key: "focus", label: "Skill stations", intent: "High-quality skill reps" },
      { key: "apply", label: "Games & compete", intent: "Use skills under pressure" },
      { key: "close", label: "Cool-down & debrief", intent: "Recover and lock learning" },
    ],
    sidePanels: [
      { id: "setup", title: "Equipment" },
      { id: "cues", title: "Coaching cues" },
      { id: "sources", title: "Sources" },
    ],
    setupDefaults: ["Confirm space and audience from the brief", "Stage materials from cited curriculum"],
    cueDefaults: ["Follow cited curriculum", "One coaching cue at a time", "Do not invent drills"],
  }),
  Object.freeze({
    id: "service_appointment",
    matchKeywords: ["appointment", "consult", "visit", "intake visit", "patient", "client meeting"],
    sessionPhases: [
      { key: "open", label: "Arrive & settle", intent: "Confirm goal and constraints" },
      { key: "focus", label: "Core work", intent: "Deliver the specialty outcome" },
      { key: "apply", label: "Verify & adjust", intent: "Validate with the customer" },
      { key: "close", label: "Wrap & next steps", intent: "Document and follow through" },
    ],
    sidePanels: [
      { id: "setup", title: "Bring / prepare" },
      { id: "cues", title: "Quality checks" },
      { id: "sources", title: "Sources" },
    ],
    setupDefaults: ["Customer record", "Prior work", "Required documents"],
    cueDefaults: ["Confirm understanding out loud", "Capture decisions in Work", "Outbound only after approval"],
  }),
  Object.freeze({
    id: "operations_block",
    matchKeywords: ["shift", "ops", "opening", "closing", "production block"],
    sessionPhases: [
      { key: "open", label: "Kickoff", intent: "Align people and priorities" },
      { key: "focus", label: "Primary block", intent: "Execute highest-value work" },
      { key: "apply", label: "Exceptions", intent: "Clear blockers and handoffs" },
      { key: "close", label: "Handoff", intent: "Leave a clean next shift" },
    ],
    sidePanels: [
      { id: "setup", title: "Required inputs" },
      { id: "cues", title: "Owner watches" },
      { id: "sources", title: "Sources" },
    ],
    setupDefaults: ["Active Work queue", "Staffing list", "Known constraints"],
    cueDefaults: ["Protect the primary block", "Escalate early", "Leave searchable notes"],
  }),
  Object.freeze({
    id: "generic_session",
    matchKeywords: [],
    sessionPhases: [
      { key: "open", label: "Open", intent: "Set context and success criteria" },
      { key: "focus", label: "Build", intent: "Produce the specialty output" },
      { key: "apply", label: "Pressure test", intent: "Validate under real constraints" },
      { key: "close", label: "Close", intent: "Capture next actions" },
    ],
    sidePanels: [
      { id: "setup", title: "Inputs" },
      { id: "cues", title: "Watch-outs" },
      { id: "sources", title: "Sources" },
    ],
    setupDefaults: ["Brief", "Existing Work", "Knowledge"],
    cueDefaults: ["Stay evidence-based", "No silent outbound", "Ask when stuck"],
  }),
]);

export function resolveSpecialtyArtifactTemplate({
  label = "",
  purpose = "",
  instruction = "",
  templateId = null,
} = {}) {
  if (templateId && SPECIALTY_ARTIFACT_TEMPLATES[templateId]) {
    return SPECIALTY_ARTIFACT_TEMPLATES[templateId];
  }
  const blob = `${label} ${purpose} ${instruction}`.toLowerCase();
  let best = SPECIALTY_ARTIFACT_TEMPLATES.structured_brief;
  let bestHits = -1;
  for (const template of Object.values(SPECIALTY_ARTIFACT_TEMPLATES)) {
    if (template.id === "structured_brief") continue;
    const hits = (template.matchKeywords ?? []).filter((kw) => blob.includes(String(kw).toLowerCase())).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = template;
    }
  }
  return bestHits > 0 ? best : SPECIALTY_ARTIFACT_TEMPLATES.structured_brief;
}

export function resolveVocabularyPack({ label = "", purpose = "", instruction = "" } = {}) {
  const blob = `${label} ${purpose} ${instruction}`.toLowerCase();
  let best = SPECIALTY_VOCABULARY_PACKS[SPECIALTY_VOCABULARY_PACKS.length - 1];
  let bestHits = -1;
  for (const pack of SPECIALTY_VOCABULARY_PACKS) {
    const hits = (pack.matchKeywords ?? []).filter((kw) => blob.includes(String(kw).toLowerCase())).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = pack;
    }
  }
  return best;
}

/**
 * Compose a structured specialty deliverable.
 * Session content activities come only from consultResult.sources (Knowledge + authority packs).
 */
export function composeSpecialtyArtifact({
  label,
  purpose,
  instruction,
  nowISO,
  templateId = null,
  consultResult = null,
  sources = null,
} = {}) {
  const template = resolveSpecialtyArtifactTemplate({ label, purpose, instruction, templateId });
  const brief = String(instruction ?? "").trim() || `Prepare the next deliverable for: ${purpose}`;
  const context = extractBriefContext(brief);
  const resolvedSources = Array.isArray(sources)
    ? sources
    : (Array.isArray(consultResult?.sources) ? consultResult.sources : []);
  const gaps = Array.isArray(consultResult?.gaps) ? consultResult.gaps : [];

  if (template.id === "session_flow" || template.id === "station_board") {
    return composeSessionStyleArtifact({
      template,
      vocabulary: resolveVocabularyPack({ label, purpose, instruction: brief }),
      label,
      purpose,
      brief,
      context,
      nowISO,
      board: template.id === "station_board",
      sources: resolvedSources,
      gaps,
      consultResult,
    });
  }
  if (template.id === "checklist_run") {
    return composeChecklistArtifact({ label, purpose, brief, context, nowISO });
  }
  if (template.id === "outreach_sequence") {
    return composeOutreachArtifact({ label, purpose, brief, context, nowISO });
  }
  return composeStructuredBriefArtifact({ label, purpose, brief, context, nowISO });
}

function composeSessionStyleArtifact({
  template,
  vocabulary,
  label,
  purpose,
  brief,
  context,
  nowISO,
  board = false,
  sources = [],
  gaps = [],
  consultResult = null,
}) {
  const durationMins = context.durationMins ?? template.defaultDurationMins ?? 60;
  const weights = [0.15, 0.35, 0.3, 0.2];
  const theme = context.theme
    ?? summarizeThemeFromBrief(brief)
    ?? "session focus from the brief";
  const audience = context.audience ?? "full group";

  const extracted = extractActivitiesFromSources(sources, { maxActivities: 12 });
  const phaseKeys = vocabulary.sessionPhases.map((phase) => phase.key);
  const distributed = distributeActivitiesAcrossPhases(extracted, phaseKeys);

  const effectiveGaps = [...gaps];
  if (!extracted.length && !effectiveGaps.some((gap) => gap.code === "missing_curriculum_sources")) {
    effectiveGaps.push({ ...MISSING_CURRICULUM_GAP });
  }

  const phases = vocabulary.sessionPhases.map((phase, index) => {
    const minutes = Math.max(5, Math.round(durationMins * weights[index]));
    const phaseActivities = (distributed[phase.key] ?? []).map((activity, activityIndex, list) => {
      const share = Math.max(3, Math.floor(minutes / Math.max(1, list.length)));
      const activityMinutes = activityIndex === list.length - 1
        ? Math.max(3, minutes - share * (list.length - 1))
        : share;
      return {
        ...activity,
        id: `${phase.key}_${activityIndex + 1}`,
        minutes: activityMinutes,
        durationLabel: `${activityMinutes} min`,
      };
    });
    return {
      id: phase.key,
      label: phase.label,
      intent: phase.intent,
      durationMins: minutes,
      durationLabel: `${minutes} min`,
      details: phaseActivities.length
        ? phaseActivities.map((activity) => activity.name)
        : [
          phase.intent,
          "Awaiting cited curriculum content for this block",
        ],
      activities: phaseActivities,
    };
  });

  const used = phases.slice(0, -1).reduce((sum, phase) => sum + phase.durationMins, 0);
  phases[phases.length - 1].durationMins = Math.max(5, durationMins - used);
  phases[phases.length - 1].durationLabel = `${phases[phases.length - 1].durationMins} min`;

  const title = `${context.day ?? "Session"} plan — ${audience}`;
  const setup = Array.isArray(vocabulary.setupDefaults) ? [...vocabulary.setupDefaults] : [];
  setup.push(`Audience: ${audience}`);
  setup.push(`Total planned time: ${durationMins} minutes`);
  const cues = Array.isArray(vocabulary.cueDefaults) ? [...vocabulary.cueDefaults] : [];
  cues.unshift(`Theme: ${theme}`);

  const sourceItems = sources.length
    ? sources.slice(0, 6).map((source) => {
      const where = source.url ? source.url : (source.knowledgeDocId ? `Knowledge ${source.knowledgeDocId}` : "Knowledge");
      return `${source.org}: ${source.title} (${where})`;
    })
    : ["No curriculum sources consulted yet — add Knowledge or enable a matching authority pack."];

  if (effectiveGaps.length) {
    for (const gap of effectiveGaps) {
      sourceItems.push(`Gap: ${gap.message ?? gap.code}`);
    }
  }

  const diagram = deepFreeze({
    layout: board ? "station_board" : "timeline",
    templateId: template.id,
    vocabularyId: vocabulary.id,
    header: deepFreeze({
      title,
      subtitle: brief,
      meta: [
        { label: "Built by", value: String(label) },
        { label: "Audience", value: audience },
        { label: "Theme", value: theme },
        { label: "Duration", value: `${durationMins} min` },
        {
          label: "Sources",
          value: sources.length
            ? sources.slice(0, 2).map((source) => source.org).join(", ")
            : "None — gap",
        },
      ],
    }),
    nodes: deepFreeze(phases.map((phase, index) => ({
      id: phase.id,
      index: index + 1,
      label: phase.label,
      intent: phase.intent,
      durationLabel: phase.durationLabel,
      details: phase.details,
      activities: phase.activities,
    }))),
    sidePanels: deepFreeze([
      { id: "setup", title: vocabulary.sidePanels?.[0]?.title ?? "Setup", items: setup },
      { id: "cues", title: vocabulary.sidePanels?.[1]?.title ?? "Cues", items: cues },
      { id: "sources", title: vocabulary.sidePanels?.[2]?.title ?? "Sources", items: sourceItems },
    ]),
    gaps: deepFreeze(effectiveGaps),
  });

  return deepFreeze({
    kind: "specialty_deliverable",
    templateId: template.id,
    title,
    format: "structured",
    body: renderArtifactMarkdown({ label, purpose, brief, nowISO, diagram }),
    generatedAt: nowISO,
    diagram,
    sources: deepFreeze(sources.map((source) => ({
      id: source.id,
      org: source.org,
      title: source.title,
      url: source.url ?? null,
      knowledgeDocId: source.knowledgeDocId ?? null,
      provenance: source.provenance,
      packId: source.packId ?? null,
    }))),
    gaps: deepFreeze(effectiveGaps),
    consultSummary: consultResult
      ? deepFreeze({
        consultedAt: consultResult.consultedAt ?? nowISO,
        packMatches: consultResult.packMatches ?? [],
        preferredSourceId: consultResult.preferred?.id ?? null,
      })
      : null,
  });
}

function distributeActivitiesAcrossPhases(activities, phaseKeys) {
  const buckets = Object.fromEntries(phaseKeys.map((key) => [key, []]));
  if (!activities.length) return buckets;

  for (const activity of activities) {
    const phase = inferPhaseKey(activity, phaseKeys);
    buckets[phase].push(activity);
  }

  // Keep phase structure honest: unused middle phases stay empty rather than inventing fillers.
  return buckets;
}

function inferPhaseKey(activity, phaseKeys) {
  const blob = `${activity.name} ${(activity.steps ?? []).join(" ")}`.toLowerCase();
  if (/warm|activation|arrive|kickoff|open/.test(blob) && phaseKeys.includes("open")) return "open";
  if (/cool|debrief|recover|handoff|close|wrap/.test(blob) && phaseKeys.includes("close")) return "close";
  if (/game|compete|small-?area|scrimmage|pressure|race|transition/.test(blob) && phaseKeys.includes("apply")) {
    return "apply";
  }
  if (phaseKeys.includes("focus")) return "focus";
  return phaseKeys[0];
}

function summarizeThemeFromBrief(brief) {
  const text = String(brief ?? "").trim();
  if (!text) return null;
  const cleaned = text
    .replace(/^(build|create|make|prepare)\s+/i, "")
    .replace(/\b(for|with)\s+U\d+\b/i, "")
    .trim();
  if (!cleaned) return null;
  return truncate(cleaned, 48);
}

function composeChecklistArtifact({ label, purpose, brief, context, nowISO }) {
  const steps = [
    { id: "scope", label: "Scope", details: [`Confirm what “done” means for: ${brief}`] },
    { id: "collect", label: "Collect evidence", details: ["Pull facts from People, Knowledge, and Work"] },
    { id: "inspect", label: "Run checks", details: ["Walk each required checkpoint", "Flag exceptions with owners"] },
    { id: "report", label: "Report", details: ["Summarize findings", "List remediations for approval"] },
  ];
  const title = `${context.day ?? "Checklist"} run`;
  const diagram = deepFreeze({
    layout: "sequence",
    templateId: "checklist_run",
    vocabularyId: "generic",
    header: deepFreeze({
      title,
      subtitle: brief,
      meta: [
        { label: "Built by", value: String(label) },
        { label: "Purpose", value: String(purpose) },
      ],
    }),
    nodes: deepFreeze(steps.map((step, index) => ({
      id: step.id,
      index: index + 1,
      label: step.label,
      intent: null,
      durationLabel: null,
      details: step.details,
    }))),
    sidePanels: deepFreeze([
      { id: "inputs", title: "Inputs", items: ["Brief", "Prior work", "Known constraints"] },
      { id: "outputs", title: "Outputs", items: ["Exception list", "Owner next actions"] },
    ]),
  });
  return deepFreeze({
    kind: "specialty_deliverable",
    templateId: "checklist_run",
    title,
    format: "structured",
    body: renderArtifactMarkdown({ label, purpose, brief, nowISO, diagram }),
    generatedAt: nowISO,
    diagram,
  });
}

function composeOutreachArtifact({ label, purpose, brief, context, nowISO }) {
  const steps = [
    { id: "segment", label: "Segment", details: ["Define who this is for"] },
    { id: "draft", label: "Draft message", details: [`Anchor to: ${brief}`, "Keep outbound as draft only"] },
    { id: "review", label: "Owner review", details: ["Require approval before send"] },
    { id: "follow", label: "Follow-up", details: ["Schedule next touch only after approval"] },
  ];
  const title = `${context.day ?? "Outreach"} sequence`;
  const diagram = deepFreeze({
    layout: "sequence",
    templateId: "outreach_sequence",
    vocabularyId: "generic",
    header: deepFreeze({
      title,
      subtitle: brief,
      meta: [
        { label: "Built by", value: String(label) },
        { label: "Purpose", value: String(purpose) },
      ],
    }),
    nodes: deepFreeze(steps.map((step, index) => ({
      id: step.id,
      index: index + 1,
      label: step.label,
      intent: null,
      durationLabel: null,
      details: step.details,
    }))),
    sidePanels: deepFreeze([
      { id: "guards", title: "Guardrails", items: ["No silent customer send", "Approval required for outbound"] },
    ]),
  });
  return deepFreeze({
    kind: "specialty_deliverable",
    templateId: "outreach_sequence",
    title,
    format: "structured",
    body: renderArtifactMarkdown({ label, purpose, brief, nowISO, diagram }),
    generatedAt: nowISO,
    diagram,
  });
}

function composeStructuredBriefArtifact({ label, purpose, brief, context, nowISO }) {
  const title = `${label} brief`;
  const diagram = deepFreeze({
    layout: "cards",
    templateId: "structured_brief",
    vocabularyId: "generic",
    header: deepFreeze({
      title,
      subtitle: brief,
      meta: [
        { label: "Built by", value: String(label) },
        { label: "Purpose", value: String(purpose) },
      ],
    }),
    nodes: deepFreeze([
      {
        id: "goal",
        index: 1,
        label: "Goal",
        intent: "What success looks like",
        durationLabel: null,
        details: [brief],
      },
      {
        id: "evidence",
        index: 2,
        label: "Evidence to use",
        intent: "Sources already in VIBETech",
        durationLabel: null,
        details: ["People", "Knowledge", "Work"],
      },
      {
        id: "output",
        index: 3,
        label: "Deliverable shape",
        intent: "What the owner reviews",
        durationLabel: null,
        details: ["Structured specialty output", "Next actions", "Outbound drafts only if needed"],
      },
      {
        id: "next",
        index: 4,
        label: "Next actions",
        intent: "Owner controls",
        durationLabel: null,
        details: ["Review on Work", "Ask for revisions", "Approve any outbound before send"],
      },
    ]),
    sidePanels: deepFreeze([]),
  });
  return deepFreeze({
    kind: "specialty_deliverable",
    templateId: "structured_brief",
    title,
    format: "structured",
    body: renderArtifactMarkdown({ label, purpose, brief, nowISO, diagram }),
    generatedAt: nowISO,
    diagram,
  });
}

function extractBriefContext(text) {
  const raw = String(text ?? "");
  const dayMatch = raw.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|tomorrow)\b/i);
  const durationMatch = raw.match(/\b(\d{2,3})\s*(?:min|mins|minutes)\b/i);
  const audienceMatch = raw.match(/\b(U\d{1,2}|peewee|bantam|varsity|jv|adults?)\b/i)
    ?? raw.match(/\bfor\s+(?:the\s+)?([A-Za-z0-9][\w\s-]{1,40}?)\s+(?:team|players|group|clients?|patients?)\b/i);
  const theme = (() => {
    const lower = raw.toLowerCase();
    if (/skating|edges|stride/.test(lower)) return "skating edges and stride";
    if (/shooting|scoring/.test(lower)) return "shooting / finishing";
    if (/passing|support/.test(lower)) return "passing options and support";
    if (/defense|gap/.test(lower)) return "defensive gaps and retrievals";
    if (/intake|consult/.test(lower)) return "intake quality and clarity";
    if (/follow.?up/.test(lower)) return "follow-up completion";
    return null;
  })();

  return {
    day: dayMatch ? titleCase(dayMatch[1]) : null,
    durationMins: durationMatch ? Math.min(180, Math.max(20, Number(durationMatch[1]))) : null,
    audience: audienceMatch
      ? (String(audienceMatch[1]).toUpperCase().startsWith("U")
        ? String(audienceMatch[1]).toUpperCase()
        : titleCase(audienceMatch[1]))
      : null,
    theme,
  };
}

function renderArtifactMarkdown({ label, purpose, brief, nowISO, diagram }) {
  const lines = [
    `# ${diagram.header.title}`,
    "",
    `Built by: ${label}`,
    `Purpose: ${purpose}`,
    `Requested: ${brief}`,
    `Generated: ${nowISO}`,
    "",
  ];
  for (const node of diagram.nodes ?? []) {
    lines.push(`## ${node.index}. ${node.label}${node.durationLabel ? ` (${node.durationLabel})` : ""}`);
    if (node.intent) lines.push(`_${node.intent}_`);
    for (const activity of node.activities ?? []) {
      lines.push(`### ${activity.name}${activity.durationLabel ? ` — ${activity.durationLabel}` : ""}`);
      if (activity.setup) lines.push(`Setup: ${activity.setup}`);
      for (const step of activity.steps ?? []) lines.push(`- ${step}`);
      for (const citation of activity.citations ?? []) {
        lines.push(`Source: ${citation.org}${citation.url ? ` — ${citation.url}` : ""}`);
      }
      lines.push("");
    }
    if (!(node.activities ?? []).length) {
      for (const detail of node.details ?? []) lines.push(`- ${detail}`);
      lines.push("");
    }
  }
  for (const panel of diagram.sidePanels ?? []) {
    lines.push(`## ${panel.title}`);
    for (const item of panel.items ?? []) lines.push(`- ${item}`);
    lines.push("");
  }
  return lines.join("\n");
}

function titleCase(text) {
  return String(text).replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncate(text, max) {
  const value = String(text ?? "");
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Preserve cited artifacts. Do not invent drills on hydrate.
 * Uncited / outline-only artifacts recompose from sources when provided; otherwise structure + gap.
 */
export function hydrateSpecialtyArtifact({
  artifact = null,
  label = "Specialty",
  purpose = "",
  instruction = "",
  nowISO = null,
  consultResult = null,
  sources = null,
} = {}) {
  if (!artifact || typeof artifact !== "object") return null;
  const nodes = Array.isArray(artifact?.diagram?.nodes) ? artifact.diagram.nodes : [];
  const hasCitedActivities = nodes.some((node) =>
    Array.isArray(node?.activities)
    && node.activities.some((activity) => Array.isArray(activity?.citations) && activity.citations.length > 0),
  );
  if (hasCitedActivities) return artifact;

  const resolvedSources = Array.isArray(sources)
    ? sources
    : (Array.isArray(consultResult?.sources) ? consultResult.sources : (artifact.sources ?? []));

  const brief = String(
    instruction
    || artifact?.diagram?.header?.subtitle
    || artifact?.title
    || purpose
    || "",
  ).trim();

  // Session-style templates: recompose so invented uncited drills are replaced by sources or a gap.
  const templateId = artifact?.templateId ?? null;
  if (templateId === "session_flow" || templateId === "station_board" || artifact?.diagram?.layout === "timeline") {
    return composeSpecialtyArtifact({
      label: String(label || artifact?.diagram?.header?.meta?.find?.((m) => m?.label === "Built by")?.value || "Specialty"),
      purpose: String(purpose || ""),
      instruction: brief || "Prepare the next specialty deliverable",
      nowISO: String(nowISO || artifact?.generatedAt || new Date().toISOString()),
      templateId: templateId ?? "session_flow",
      consultResult: consultResult ?? {
        sources: resolvedSources,
        gaps: resolvedSources.length ? [] : [{ ...MISSING_CURRICULUM_GAP }],
        packMatches: [],
        preferred: resolvedSources[0] ?? null,
        consultedAt: String(nowISO || artifact?.generatedAt || new Date().toISOString()),
      },
      sources: resolvedSources,
    });
  }

  return artifact;
}

/** @deprecated Use composeSpecialtyArtifact — kept for older imports/tests. */
export function buildSpecialtyArtifact(args) {
  return composeSpecialtyArtifact(args);
}
