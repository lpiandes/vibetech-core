/**
 * Minimal text PDF builder for categorized Social Checker downloads.
 * Browser-safe (TextEncoder) — no Node Buffer.
 */
function pdfEscape(text: string) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function byteLength(s: string) {
  return new TextEncoder().encode(s).length;
}

type Hit = {
  network?: string;
  kind?: string;
  title?: string;
  url?: string;
  snippet?: string;
  confidence?: number;
};

type Platform = {
  network: string;
  label: string;
  profile?: Hit | null;
  posts?: Hit[];
  tags?: Hit[];
  mentions?: Hit[];
  visibility?: string;
  postsEmptyReason?: string | null;
  tagsEmptyReason?: string | null;
  tagsNote?: string | null;
};

function pushHit(lines: string[], hit: Hit, label: string) {
  lines.push(`  [${label}] ${hit.title || "Untitled"}`);
  if (hit.url) lines.push(`    ${hit.url}`);
  if (hit.snippet) lines.push(`    ${hit.snippet}`);
  if (hit.confidence != null) lines.push(`    Confidence: ${hit.confidence}`);
  lines.push("");
}

export function buildSocialCheckerPdf(report: {
  subject: {
    name?: string;
    handle?: string | null;
    handlesByPlatform?: Record<string, string>;
  };
  profiles?: Hit[];
  platforms?: Platform[];
  discoveredHandles?: string[];
  generatedAt?: string;
  disclaimer?: string;
}): Blob {
  const handleBits = report.subject?.handlesByPlatform
    ? Object.entries(report.subject.handlesByPlatform).map(([net, h]) => `${net}:@${h}`)
    : [];
  const lines: string[] = [
    "VibeTech Social Checker",
    `Subject: ${report.subject?.name || "—"}${report.subject?.handle ? ` (@${report.subject.handle})` : ""}`,
    `Generated: ${report.generatedAt || new Date().toISOString()}`,
    "",
  ];

  if (handleBits.length) {
    lines.push(`Handles used: ${handleBits.join(", ")}`);
    lines.push("");
  }

  if (report.discoveredHandles?.length) {
    lines.push(`Handles found: ${report.discoveredHandles.map((h) => `@${h}`).join(", ")}`);
    lines.push("");
  }

  const platforms = Array.isArray(report.platforms) ? report.platforms : [];
  if (platforms.length) {
    for (const platform of platforms) {
      lines.push(String(platform.label || platform.network).toUpperCase());
      if (platform.visibility === "private") lines.push("  [PRIVATE PROFILE]");
      lines.push("--------");
      if (platform.profile) pushHit(lines, platform.profile, "PROFILE");
      else lines.push("  (No clear profile URL found)", "");
      if (platform.posts?.length) {
        lines.push("  Posts / media");
        for (const hit of platform.posts.slice(0, 25)) pushHit(lines, hit, "POST");
      } else if (platform.postsEmptyReason) {
        lines.push(`  Posts: ${platform.postsEmptyReason}`, "");
      }
      if (platform.tags?.length) {
        lines.push("  Tags (@mentions of them)");
        if (platform.tagsNote) lines.push(`  Note: ${platform.tagsNote}`);
        for (const hit of platform.tags.slice(0, 25)) pushHit(lines, hit, "TAG");
      } else if (platform.tagsEmptyReason) {
        lines.push(`  Tags: ${platform.tagsEmptyReason}`, "");
      }
      if (platform.mentions?.length) {
        lines.push("  Name mentions");
        for (const hit of platform.mentions.slice(0, 25)) pushHit(lines, hit, "MENTION");
      }
      lines.push("");
    }
  } else if (report.profiles?.length) {
    for (const p of report.profiles.slice(0, 80)) {
      pushHit(lines, p, String(p.network || "web").toUpperCase());
    }
  } else {
    lines.push("No public profiles found.");
  }

  if (report.disclaimer) {
    lines.push("Disclaimer");
    lines.push(report.disclaimer);
  }

  const contentLines = lines.flatMap((line) => {
    const wrapped = wrapLine(line, 95);
    return wrapped.length ? wrapped : [""];
  });

  const pages: string[][] = [];
  for (let i = 0; i < contentLines.length; i += 48) {
    pages.push(contentLines.slice(i, i + 48));
  }
  if (!pages.length) pages.push([""]);

  const rebuilt: string[] = [];
  rebuilt.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj");

  let objId = 3;
  const streamParts: { id: number; stream: string }[] = [];
  const pageParts: { id: number; contentId: number }[] = [];
  const pageRefs: number[] = [];

  for (const pageLines of pages) {
    const content: string[] = ["BT", "/F1 10 Tf", "50 780 Td", "14 TL"];
    pageLines.forEach((line, i) => {
      if (i === 0) content.push(`(${pdfEscape(line)}) Tj`);
      else content.push(`T* (${pdfEscape(line)}) Tj`);
    });
    content.push("ET");
    const stream = content.join("\n");
    const contentId = objId++;
    const pageId = objId++;
    streamParts.push({ id: contentId, stream });
    pageParts.push({ id: pageId, contentId });
    pageRefs.push(pageId);
  }
  const fontId = objId;

  rebuilt.push(
    `2 0 obj<< /Type /Pages /Kids [${pageRefs.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageRefs.length} >>endobj`,
  );
  for (const { id, stream } of streamParts) {
    rebuilt.push(`${id} 0 obj<< /Length ${byteLength(stream)} >>stream\n${stream}\nendstream endobj`);
  }
  for (const { id, contentId } of pageParts) {
    rebuilt.push(
      `${id} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>endobj`,
    );
  }
  rebuilt.push(`${fontId} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of rebuilt) {
    offsets.push(byteLength(pdf));
    pdf += `${obj}\n`;
  }
  const xrefStart = byteLength(pdf);
  pdf += `xref\n0 ${rebuilt.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${rebuilt.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function wrapLine(text: string, width: number) {
  const s = String(text ?? "");
  if (s.length <= width) return [s];
  const out: string[] = [];
  let rest = s;
  while (rest.length > width) {
    out.push(rest.slice(0, width));
    rest = rest.slice(width);
  }
  if (rest) out.push(rest);
  return out;
}
