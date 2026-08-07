/**
 * Public lead intake from the marketing site (contact + alliance partner forms).
 * Emails Leo, Brett, and Cary via Resend.
 */
import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://vtechdevelopment.com",
  "https://www.vtechdevelopment.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const INTAKE_TO = [
  "leopiandes@vtechdevelopment.com",
  "brettbaldassare@vtechdevelopment.com",
  "carynorthrop@vtechdevelopment.com",
];

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://vtechdevelopment.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function sanitizeHeaderField(value: string) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await request.json().catch(() => ({}));
    const honeypot = String(body?.company_website ?? body?.honeypot ?? "").trim();
    if (honeypot) {
      return NextResponse.json({ ok: true }, { status: 200, headers });
    }

    const type = String(body?.type ?? "contact").trim().toLowerCase();
    const name = sanitizeHeaderField(String(body?.name ?? "")).slice(0, 120);
    const email = sanitizeHeaderField(String(body?.email ?? "")).slice(0, 200);
    const phone = sanitizeHeaderField(String(body?.phone ?? "")).slice(0, 40);

    if (!name || !email || !email.includes("@") || !phone) {
      return NextResponse.json(
        { error: "name, phone, and valid email are required" },
        { status: 400, headers },
      );
    }

    let subject = "";
    let textLines: string[] = [];

    if (type === "partner") {
      const businessName = sanitizeHeaderField(String(body?.businessName ?? body?.business_name ?? "")).slice(0, 160);
      const website = sanitizeHeaderField(String(body?.website ?? "")).slice(0, 300);
      if (!businessName || !website) {
        return NextResponse.json(
          { error: "business name and website are required" },
          { status: 400, headers },
        );
      }
      subject = `Alliance partner inquiry — ${businessName}`;
      textLines = [
        "New VibeTech Alliance partner inquiry from vtechdevelopment.com",
        "",
        `Name: ${name}`,
        `Business name: ${businessName}`,
        `Phone: ${phone}`,
        `Email: ${email}`,
        `Website: ${website || "(not provided)"}`,
      ];
    } else {
      const company = sanitizeHeaderField(String(body?.company ?? "")).slice(0, 160);
      subject = `Contact request — ${name}${company ? ` (${company})` : ""}`;
      textLines = [
        "New contact form submission from vtechdevelopment.com",
        "",
        `Name: ${name}`,
        `Phone: ${phone}`,
        `Email: ${email}`,
        `Company: ${company || "(not provided)"}`,
      ];
    }

    const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Intake inbox is not configured yet. Email leopiandes@vtechdevelopment.com directly.",
        },
        { status: 503, headers },
      );
    }

    const from =
      process.env.OPS_EMAIL_FROM ||
      process.env.INVITATION_EMAIL_FROM ||
      "VibeTech Development <onboarding@resend.dev>";

    const text = textLines.join("\n");
    const html = `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(text)}</pre>`;

    const results: Array<{ to: string; sent: boolean }> = [];
    for (const to of INTAKE_TO) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: sanitizeHeaderField(subject).slice(0, 200),
          text,
          html,
          reply_to: email,
        }),
      });
      results.push({
        to,
        sent: res.ok === true,
      });
    }

    const anySent = results.some((r) => r.sent);
    if (!anySent) {
      return NextResponse.json(
        { error: "Could not deliver intake email" },
        { status: 502, headers },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Intake request failed";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
