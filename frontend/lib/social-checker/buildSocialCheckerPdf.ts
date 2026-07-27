/**
 * Minimal text PDF builder (no deps) for Social Checker result downloads.
 * Browser-safe (TextEncoder) — no Node Buffer.
 */
function pdfEscape(text: string) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function byteLength(s: string) {
  return new TextEncoder().encode(s).length;
}

export function buildSocialCheckerPdf(report: {
  subject: { name?: string; handle?: string | null };
  profiles: Array<{ network?: string; title?: string; url?: string; snippet?: string; confidence?: number }>;
  generatedAt?: string;
  disclaimer?: string;
}): Blob {
  const lines: string[] = [
    "VibeTech Social Checker",
    `Subject: ${report.subject?.name || "—"}${report.subject?.handle ? ` (@${report.subject.handle})` : ""}`,
    `Generated: ${report.generatedAt || new Date().toISOString()}`,
    "",
    "Profiles",
    "-------",
  ];

  if (!report.profiles?.length) {
    lines.push("No public profiles found.");
  } else {
    for (const p of report.profiles.slice(0, 40)) {
      lines.push(`[${String(p.network || "web").toUpperCase()}] ${p.title || "Untitled"}`);
      if (p.url) lines.push(`  ${p.url}`);
      if (p.snippet) lines.push(`  ${p.snippet}`);
      if (p.confidence != null) lines.push(`  Confidence: ${p.confidence}`);
      lines.push("");
    }
  }

  if (report.disclaimer) {
    lines.push("Disclaimer");
    lines.push(report.disclaimer);
  }

  const contentLines = lines.flatMap((line) => {
    const wrapped = wrapLine(line, 95);
    return wrapped.length ? wrapped : [""];
  });

  const content: string[] = ["BT", "/F1 11 Tf", "50 780 Td", "14 TL"];
  contentLines.forEach((line, i) => {
    if (i === 0) content.push(`(${pdfEscape(line)}) Tj`);
    else content.push(`T* (${pdfEscape(line)}) Tj`);
  });
  content.push("ET");
  const stream = content.join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
  );
  objects.push(`4 0 obj<< /Length ${byteLength(stream)} >>stream\n${stream}\nendstream endobj`);
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(byteLength(pdf));
    pdf += `${obj}\n`;
  }
  const xrefStart = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

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
