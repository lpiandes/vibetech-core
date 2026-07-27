/**
 * OpenAIProvider
 *
 * Modes:
 * 1) demo (default): deterministic placeholder for local/dev without a key
 * 2) live: real Chat Completions when OPENAI_API_KEY is set
 */

import crypto from "node:crypto";

import { LLMProvider } from "./LLMProvider.js";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export class OpenAIProvider extends LLMProvider {
  /**
   * @param {object} [params]
   * @param {"demo"|"live"} [params.mode]
   * @param {string} [params.model]
   * @param {typeof fetch} [params.fetchImpl]
   */
  constructor({ mode = "demo", model = DEFAULT_MODEL, fetchImpl = null } = {}) {
    super();
    this.mode = mode;
    this.model = model;
    this.fetchImpl = fetchImpl || globalThis.fetch?.bind(globalThis) || null;
  }

  /**
   * @param {string} prompt
   * @param {object} [options]
   * @param {boolean} [options.json]
   * @param {number} [options.temperature]
   * @returns {Promise<string> | string}
   */
  async generate(prompt, options = {}) {
    const normalizedPrompt = String(prompt ?? "");
    if (this.mode === "demo") {
      return this.#demoGenerate(normalizedPrompt, options);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return [
        "LIVE MODE REQUESTED, BUT OPENAI_API_KEY IS NOT SET.",
        "Fall back to demo/deterministic proposer.",
        "",
        `prompt_sha256: ${this.#promptHash(normalizedPrompt)}`,
      ].join("\n");
    }

    if (typeof this.fetchImpl !== "function") {
      throw new Error("OpenAIProvider: fetch is not available in this runtime");
    }

    const wantJson = Boolean(options.json);
    const temperature = Number.isFinite(Number(options.temperature))
      ? Number(options.temperature)
      : 0.2;

    const body = {
      model: this.model,
      temperature,
      messages: [
        {
          role: "system",
          content: wantJson
            ? "You are a precise automation engineer. Reply with valid JSON only. No markdown."
            : "You are a helpful business operating assistant.",
        },
        { role: "user", content: normalizedPrompt },
      ],
    };
    if (wantJson) {
      body.response_format = { type: "json_object" };
    }

    const res = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data?.error?.message || res.statusText || `HTTP ${res.status}`;
      throw new Error(`OpenAI error: ${detail}`);
    }

    const text = data?.choices?.[0]?.message?.content;
    if (text == null || String(text).trim() === "") {
      throw new Error("OpenAI error: empty completion");
    }
    return String(text);
  }

  #demoGenerate(prompt, options = {}) {
    const hash = this.#promptHash(prompt);
    if (options.json) {
      return JSON.stringify({
        summary: "Demo mode — set OPENAI_API_KEY for live proposals",
        notes: ["demo_placeholder"],
        prompt_sha256: hash,
      });
    }
    return [
      "[DEMO DRAFT — deterministic placeholder]",
      "",
      "Draft Summary:",
      "This is a local-development placeholder draft produced by the demo LLM provider.",
      "",
      "Trace:",
      `prompt_sha256: ${hash}`,
    ].join("\n");
  }

  #promptHash(prompt) {
    return crypto.createHash("sha256").update(String(prompt)).digest("hex");
  }
}
