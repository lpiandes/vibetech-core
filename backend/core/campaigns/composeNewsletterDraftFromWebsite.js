/**
 * Compose newsletter draft fields from a website (or business name fallback).
 * Universal — no industry hardcoding. Uses live LLM when available.
 */
import { createLlmProvider, llmIsLiveAvailable } from "../providers/createLlmProvider.js";

function cleanUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

async function fetchWebsiteText(websiteUrl, fetchImpl = fetch) {
  const url = cleanUrl(websiteUrl);
  if (!url) return { ok: false, text: "", url: null };
  try {
    const response = await fetchImpl(url, {
      headers: { "user-agent": "VIBETechNewsletterBot/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    const html = await response.text();
    const text = String(html ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
    return { ok: Boolean(text), text, url };
  } catch {
    return { ok: false, text: "", url };
  }
}

function fallbackDraft({ businessName, listingName, websiteUrl }) {
  const brand = String(businessName || "our team").trim();
  const listing = String(listingName || "").trim();
  return {
    subjectLine: listing ? `Update on ${listing}` : `This week from ${brand}`,
    previewText: "A short note for you",
    intro: `Hope you are doing well — a quick update from ${brand}.`,
    highlights: listing
      ? `Market notes and next steps for people following ${listing}.`
      : `Here are a few highlights worth sharing this week. Replace this with your news, listings, or market notes.`,
    listingBody: listing
      ? `Featured: ${listing}. Add open-house times, price, or what makes it special.`
      : "",
    ctaText: "Reply if you want to talk",
    signature: `— ${brand}`,
    source: websiteUrl ? "website_fallback" : "manual_fallback",
  };
}

/**
 * @param {{
 *   websiteUrl?: string | null,
 *   businessName?: string | null,
 *   listingName?: string | null,
 *   fetchImpl?: typeof fetch,
 * }} [input]
 */
export async function composeNewsletterDraftFromWebsite({
  websiteUrl = null,
  businessName = null,
  listingName = null,
  fetchImpl = fetch,
} = {}) {
  const brand = String(businessName || "Your team").trim() || "Your team";
  const listing = String(listingName || "").trim() || null;
  const scraped = await fetchWebsiteText(websiteUrl, fetchImpl);

  if (!llmIsLiveAvailable()) {
    return {
      ok: true,
      draft: fallbackDraft({ businessName: brand, listingName: listing, websiteUrl: scraped.url }),
      websiteFetched: scraped.ok,
      llmUsed: false,
    };
  }

  try {
    const llm = createLlmProvider({ preferLive: true, allowDemo: false });
    const prompt = [
      "Write a short client newsletter draft.",
      "Return JSON with keys: subjectLine, previewText, intro, highlights, listingBody, ctaText, signature.",
      `Business name: ${brand}`,
      listing ? `Featured listing/property: ${listing}` : "No specific listing selected — leave listingBody empty.",
      scraped.ok
        ? `Website text (inspiration only, do not invent facts):\n${scraped.text.slice(0, 3500)}`
        : "No website text available — write a clean generic weekly update shell.",
      "Tone: warm, professional, concise. Keep each field under 400 characters.",
    ].join("\n\n");

    const text = await llm.generate(prompt, { json: true, temperature: 0.4 });
    const jsonMatch = String(text ?? "").match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    if (!parsed || typeof parsed !== "object") {
      return {
        ok: true,
        draft: fallbackDraft({ businessName: brand, listingName: listing, websiteUrl: scraped.url }),
        websiteFetched: scraped.ok,
        llmUsed: true,
        parseFailed: true,
      };
    }

    const fallback = fallbackDraft({ businessName: brand, listingName: listing, websiteUrl: scraped.url });
    return {
      ok: true,
      draft: {
        subjectLine: String(parsed.subjectLine ?? "").trim() || fallback.subjectLine,
        previewText: String(parsed.previewText ?? "").trim() || fallback.previewText,
        intro: String(parsed.intro ?? "").trim() || fallback.intro,
        highlights: String(parsed.highlights ?? "").trim() || fallback.highlights,
        listingBody: listing
          ? (String(parsed.listingBody ?? "").trim() || fallback.listingBody)
          : "",
        ctaText: String(parsed.ctaText ?? "Reply if you want to talk").trim(),
        signature: String(parsed.signature ?? `— ${brand}`).trim(),
        source: scraped.ok ? "website_llm" : "llm_only",
      },
      websiteFetched: scraped.ok,
      llmUsed: true,
    };
  } catch (error) {
    return {
      ok: true,
      draft: fallbackDraft({ businessName: brand, listingName: listing, websiteUrl: scraped.url }),
      websiteFetched: scraped.ok,
      llmUsed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
