/**
 * Public meeting-request intake from the marketing site.
 * Emails Leo, Brett, and Cary via Resend (no Calendly).
 */
import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://vtechdevelopment.com",
  "https://www.vtechdevelopment.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const MEETING_TO = [
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

    const name = String(body?.name ?? "").trim().slice(0, 120);
    const email = String(body?.email ?? "").trim().slice(0, 200);
    const preferredTimes = String(body?.preferredTimes ?? "").trim().slice(0, 500);
    const notes = String(body?.notes ?? "").trim().slice(0, 2000);
    const roi = body?.roiAssessment && typeof body.roiAssessment === "object" ? body.roiAssessment : null;

    if (!name || !email || !email.includes("@")) {
      return NextResponse.json({ error: "name and valid email required" }, { status: 400, headers });
    }

    const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Meeting request inbox is not configured yet. Email leopiandes@vtechdevelopment.com directly." },
        { status: 503, headers },
      );
    }

    const from =
      process.env.OPS_EMAIL_FROM ||
      process.env.INVITATION_EMAIL_FROM ||
      "VibeTech Development <onboarding@resend.dev>";

    const text = [
      "New meeting request from vtechdevelopment.com AI Consultant",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Preferred times: ${preferredTimes || "(not provided)"}`,
      `Notes: ${notes || "(none)"}`,
      "",
      roi ? `ROI assessment:\n${JSON.stringify(roi, null, 2)}` : "ROI assessment: (none)",
    ].join("\n");

    const html = `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(text)}</pre>`;

    const results: Array<{ to: string; sent: boolean; status: number; message?: string }> = [];
    for (const to of MEETING_TO) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: `Meeting request — ${name} (${email})`,
          text,
          html,
          reply_to: email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      results.push({
        to,
        sent: res.ok === true,
        status: res.status,
        message: String(data?.message ?? data?.error ?? "").trim() || undefined,
      });
    }

    const anySent = results.some((r) => r.sent);
    if (!anySent) {
      return NextResponse.json(
        { error: "Could not deliver meeting request email", results },
        { status: 502, headers },
      );
    }

    return NextResponse.json({ ok: true, results }, { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Meeting request failed";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
