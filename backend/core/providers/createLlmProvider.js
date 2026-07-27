/**
 * Factory for specialty / automation LLM access.
 * Prefer live OpenAI when OPENAI_API_KEY is set; otherwise demo (never crash callers).
 */
import { OpenAIProvider } from "./OpenAIProvider.js";

/**
 * @param {object} [params]
 * @param {boolean} [params.preferLive]
 * @param {string} [params.model]
 * @param {typeof fetch} [params.fetchImpl]
 */
export function createLlmProvider({
  preferLive = true,
  model = undefined,
  fetchImpl = null,
} = {}) {
  const hasKey = Boolean(String(process.env.OPENAI_API_KEY ?? "").trim());
  const mode = preferLive && hasKey ? "live" : "demo";
  return new OpenAIProvider({ mode, model, fetchImpl });
}

export function llmIsLiveAvailable() {
  return Boolean(String(process.env.OPENAI_API_KEY ?? "").trim());
}
