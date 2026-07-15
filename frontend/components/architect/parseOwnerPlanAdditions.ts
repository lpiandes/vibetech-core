/**
 * Frontend copy of owner plan-addition parsing (keeps client bundle off backend paths).
 */
export function parseOwnerPlanAdditions(text = "") {
  const raw = String(text ?? "").trim();
  if (!raw) return { modules: [], employees: [] };

  if (looksLikeCapabilitySentence(raw)) {
    return {
      modules: [],
      employees: [{
        id: `owner_emp_${slugify(raw)}`.slice(0, 48),
        label: summarizeEmployeeLabel(raw),
        purpose: raw,
        ownerAdded: true,
      }],
    };
  }

  const chunks = raw
    .split(/\n|;|,(?![^(]*\))|\band\b/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 1);

  const modules: Array<{ id: string; label: string; purpose?: string; ownerAdded?: boolean }> = [];
  const employees: Array<{ id: string; label: string; purpose?: string; ownerAdded?: boolean }> = [];
  const seen = new Set<string>();

  for (const chunk of chunks.length ? chunks : [raw]) {
    const cleaned = chunk
      .replace(/^(please\s+)?(add|include|create)\s+(a|an|the)?\s*/i, "")
      .replace(/\.$/, "")
      .trim();
    if (!cleaned || cleaned.length < 2) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const idBase = slugify(cleaned);
    if (looksLikeEmployee(cleaned)) {
      employees.push({
        id: `owner_emp_${idBase}`.slice(0, 48),
        label: titleCase(cleaned),
        purpose: `Owner-requested teammate: helps with ${cleaned.toLowerCase()}.`,
        ownerAdded: true,
      });
    } else {
      modules.push({
        id: `owner_mod_${idBase}`.slice(0, 48),
        label: titleCase(cleaned),
        ownerAdded: true,
      });
    }
  }

  return { modules, employees };
}

function looksLikeCapabilitySentence(text: string) {
  const lower = String(text).toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  if (wordCount < 5) return false;
  return /\b(generate|creates?|builds?|sends?|tracks?|manages?|handles?|coordinates?|daily|weekly|for all|every)\b/i.test(lower);
}

function summarizeEmployeeLabel(text: string) {
  const cleaned = String(text).replace(/^(please\s+)?/i, "").trim();
  if (/practice|workout|training/i.test(cleaned)) return "Practice & Workout Plan Builder";
  if (cleaned.length <= 42) return titleCase(cleaned.replace(/\.$/, ""));
  return `${titleCase(cleaned.slice(0, 36).trim())}…`;
}

function looksLikeEmployee(text: string) {
  return /\b(builder|specialist|coordinator|assistant|agent|teammate|employee|caller|generator|scheduler|coach|manager)\b/i.test(text);
}

function slugify(text: string) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || `item_${Date.now().toString(36)}`;
}

function titleCase(text: string) {
  return String(text)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function mergePlanAdditions(existing: any = {}, next: any = {}) {
  const modules = [
    ...(Array.isArray(existing.modules) ? existing.modules : []),
    ...(Array.isArray(next.modules) ? next.modules : []),
  ];
  const employees = [
    ...(Array.isArray(existing.employees) ? existing.employees : []),
    ...(Array.isArray(next.employees) ? next.employees : []),
  ];
  const byId = (list: any[]) => {
    const map = new Map();
    for (const entry of list) {
      if (!entry?.id) continue;
      map.set(String(entry.id), entry);
    }
    return [...map.values()];
  };
  return {
    modules: byId(modules),
    employees: byId(employees),
  };
}
