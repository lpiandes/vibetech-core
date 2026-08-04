/**
 * Client-side branded newsletter preview — mirrors CampaignDocumentRenderer HTML.
 * Used for live WYSIWYG while editing (no round-trip).
 */

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(displayName: string) {
  return String(displayName || "there").trim().split(/\s+/)[0] || "there";
}

export type PreviewBrand = {
  businessName?: string;
  logoUrl?: string;
  accentColor?: string;
};

export type PreviewSection = {
  id?: string;
  type: string;
  order?: number;
  fields?: {
    heading?: string | null;
    body?: string | null;
    ctaText?: string | null;
    ctaUrl?: string | null;
  };
};

function sectionHtml(section: PreviewSection, recipientName: string | null, accent: string) {
  const fields = section.fields ?? {};
  const heading = String(fields.heading ?? "").trim();
  const body = String(fields.body ?? "").trim();
  const ctaText = String(fields.ctaText ?? "").trim();
  const ctaUrl = String(fields.ctaUrl ?? "").trim();
  const type = String(section.type ?? "");
  const parts: string[] = [];

  if (heading) {
    parts.push(`<h2 style="margin:0 0 8px;font-size:18px;line-height:1.3;color:#0f172a;">${escapeHtml(heading)}</h2>`);
  }
  if (type === "intro" && recipientName) {
    parts.push(`<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">Hi ${escapeHtml(firstName(recipientName))},</p>`);
  }
  if (body) {
    for (const paragraph of body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
      parts.push(`<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;white-space:pre-wrap;">${escapeHtml(paragraph)}</p>`);
    }
  }
  if (ctaText) {
    if (ctaUrl) {
      parts.push(
        `<p style="margin:16px 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:${escapeHtml(accent)};color:#fff;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(ctaText)}</a></p>`,
      );
    } else {
      parts.push(`<p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:${escapeHtml(accent)};font-weight:700;">${escapeHtml(ctaText)}</p>`);
    }
  }
  if (!parts.length) return "";
  return `<div style="margin:0 0 22px;">${parts.join("")}</div>`;
}

export function buildNewsletterPreviewHtml({
  subjectLine,
  previewText,
  sections,
  brand,
  recipientName = "Alex",
}: {
  subjectLine?: string;
  previewText?: string;
  sections: PreviewSection[];
  brand?: PreviewBrand | null;
  recipientName?: string;
}) {
  const businessName = String(brand?.businessName ?? "Your team").trim() || "Your team";
  const logoUrl = String(brand?.logoUrl ?? "").trim();
  const accent = String(brand?.accentColor ?? "#0f766e").trim() || "#0f766e";
  const ordered = [...sections].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  const body = ordered.map((section) => sectionHtml(section, recipientName, accent)).filter(Boolean).join("");
  const preview = String(previewText ?? "").trim();
  const subject = String(subjectLine ?? "").trim() || "Update";

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(businessName)}" width="140" style="display:block;max-width:140px;height:auto;margin:0 0 16px;" />`
    : `<div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${escapeHtml(accent)};margin:0 0 16px;">${escapeHtml(businessName)}</div>`;

  return {
    subject,
    html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e2e8f0;">
      ${logoBlock}
      ${preview ? `<p style="margin:0 0 18px;font-size:13px;color:#64748b;">${escapeHtml(preview)}</p>` : ""}
      ${body || `<p style="margin:0;font-size:15px;color:#94a3b8;">Start writing on the left — the email appears here.</p>`}
      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
        Sent by ${escapeHtml(businessName)} · You can reply to this email.
      </div>
    </div>
  </div>
</body>
</html>`,
  };
}
