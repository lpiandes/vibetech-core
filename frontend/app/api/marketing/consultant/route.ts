/**
 * Public marketing-site AI consultant (CORS from vtechdevelopment.com).
 * Grounded on rate-card floors + optional ROI session payload from the static site.
 */
import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://vtechdevelopment.com",
  "https://www.vtechdevelopment.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const RATE_CARD_SUMMARY = `
Published VibeTech rate-card floors (do not invent other prices):
- Business Process Review: $3,500 one-time
- AI Strategy and Roadmap: $5,000 one-time
- AI Receptionist: $4,000 setup + $997/mo
- Automated Lead Follow-Up: $3,500 setup + $797/mo
- Workflow Automation: $3,000 setup + $697/mo
- Essential (Managed): $3,500 setup + $997/mo
- Growth (Managed): $7,500 setup + $1,997/mo
- AI Business Operating System: $20,000 setup + $3,500/mo
`;

const SYSTEM_PROMPT = `You are the VibeTech Development AI Consultant on vtechdevelopment.com.
You demonstrate what VibeTech sells: consulting + managed AI for businesses (insurance, field services, professional services, etc.).

Rules:
- Be concise, practical, and confident — not hypey.
- Recommend only services that fit the published rate card below. Never invent prices or packages outside this list.
- If the visitor's ROI assessment JSON is provided, reference it (recommended package, modeled recoverable $/mo, disclaimer that it is a modeled estimate).
- Handle objections (cost, timing, “we tried AI”) by tying back to consulting-led builds + ongoing partnership.
- Do NOT give legal, medical, or tax advice. Do not claim guaranteed ROI.
- When the visitor is ready, invite them to request a meeting (the UI has a meeting form). Do not invent calendar links.
- If asked about Social Checker, explain it is a live product at social.vtechdevelopment.com for public social screening (not FCRA).

${RATE_CARD_SUMMARY}`;

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

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await request.json().catch(() => ({}));
    const honeypot = String(body?.company_website ?? body?.honeypot ?? "").trim();
    if (honeypot) {
      return NextResponse.json({ reply: "Thanks — we'll be in touch." }, { status: 200, headers });
    }

    const messagesIn = Array.isArray(body?.messages) ? body.messages : [];
    const messages: ChatMessage[] = messagesIn
      .filter((m: unknown) => m && typeof m === "object")
      .map((m: { role?: string; content?: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "").slice(0, 4000),
      }))
      .filter((m: ChatMessage) => m.content.trim())
      .slice(-12);

    if (!messages.length) {
      return NextResponse.json({ error: "messages required" }, { status: 400, headers });
    }

    const roi = body?.roiAssessment && typeof body.roiAssessment === "object"
      ? body.roiAssessment
      : null;

    const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
      const last = messages[messages.length - 1]?.content || "";
      const fallback =
        `Thanks for asking. I'm the VibeTech AI Consultant (demo mode — live model key not configured on this environment).\n\n` +
        `For "${last.slice(0, 120)}": most teams start with either Automated Lead Follow-Up ($797/mo after setup) or a Business Process Review ($3,500) if priorities aren't clear yet.\n\n` +
        (roi?.recommendation?.packageName
          ? `Your ROI assessment pointed at ${roi.recommendation.packageName} with a modeled recoverable around $${roi?.math?.monthlyRecoverable ?? "—"}/mo — that's a modeled estimate, not a guarantee.\n\n`
          : "") +
        `Request a meeting from this chat when you're ready and we'll email the founders.`;
      return NextResponse.json({ reply: fallback, mode: "demo" }, { status: 200, headers });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const systemContent =
      SYSTEM_PROMPT +
      (roi
        ? `\n\nVisitor ROI assessment JSON (modeled estimate):\n${JSON.stringify(roi).slice(0, 3500)}`
        : "\n\nNo ROI assessment on file yet — you may suggest they take the 2-minute assessment on the homepage.");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 700,
        messages: [{ role: "system", content: systemContent }, ...messages],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data?.error?.message || res.statusText || `HTTP ${res.status}`;
      return NextResponse.json({ error: `OpenAI error: ${detail}` }, { status: 502, headers });
    }

    const reply = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502, headers });
    }

    return NextResponse.json({ reply, mode: "live" }, { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Consultant failed";
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
