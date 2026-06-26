/**
 * OpenAIProvider
 *
 * First concrete LLM provider implementation.
 *
 * Modes:
 * 1) demo mode (default, free): deterministic fake draft output for local development.
 * 2) live mode (scaffold only): prepared for later OpenAI integration.
 *    No API calls are performed in this sprint.
 *
 * Live behavior constraint:
 * - We DO NOT make any live OpenAI API calls unless OPENAI_API_KEY is present
 *   AND mode is explicitly set to "live".
 */

import crypto from "node:crypto";

import { LLMProvider } from "./LLMProvider.js";

export class OpenAIProvider extends LLMProvider {
  /**
   * @param {object} [params]
   * @param {"demo"|"live"} [params.mode] - default is "demo"
   */
  constructor({ mode = "demo" } = {}) {
    super();
    this.mode = mode;
  }

  /**
   * @param {string} prompt
   * @returns {Promise<string> | string}
   */
  generate(prompt) {
    const normalizedPrompt = String(prompt ?? "");

    if (this.mode === "demo") {
      return this.#demoGenerate(normalizedPrompt);
    }

    // Live mode scaffold:
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return [
        "LIVE MODE REQUESTED, BUT OPENAI_API_KEY IS NOT SET.",
        "Demo mode is required for free local development.",
        "",
        "Prompt hash (for traceability):",
        this.#promptHash(normalizedPrompt),
      ].join("\n");
    }

    // IMPORTANT: No live API call in this sprint.
    // This string is a deterministic placeholder so downstream logic can
    // be developed without wiring paid dependencies yet.
    return [
      "LIVE MODE SCAFFOLD (NO OPENAI CALL IN THIS SPRINT).",
      "An OpenAI integration can be wired in a later roadmap step.",
      "",
      "Prompt hash (for traceability):",
      this.#promptHash(normalizedPrompt),
    ].join("\n");
  }

  #demoGenerate(prompt) {
    const hash = this.#promptHash(prompt);

    // Deterministic fake draft content:
    // Keep it explicitly marked as a demo output so it never masquerades as real legal/AI output.
    return [
      "[DEMO DRAFT — deterministic placeholder]",
      "",
      "Draft Summary:",
      "This is a local-development placeholder draft produced by the demo LLM provider.",
      "",
      "What will happen next (later roadmap steps):",
      "- PromptBuilder output will be sent to a real LLM provider in live mode (future).",
      "- DraftGenerator will convert this into final business-ready artifacts (future).",
      "",
      "Trace:",
      `prompt_sha256: ${hash}`,
    ].join("\n");
  }

  #promptHash(prompt) {
    return crypto.createHash("sha256").update(String(prompt)).digest("hex");
  }
}

