/**
 * Factory for specialty / automation LLM access.
 * Prefer live OpenAI when OPENAI_API_KEY is set.
 * Demo mode is allowed only outside production (never fake AI drafts in prod).
 */
import { OpenAIProvider } from "./OpenAIProvider.js";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production"
    || String(process.env.VERCEL_ENV ?? "").toLowerCase() === "production";
}

/**
 * @param {object} [params]
 * @param {boolean} [params.preferLive]
 * @param {string} [params.model]
 * @param {typeof fetch} [params.fetchImpl]
 * @param {boolean} [params.allowDemo]
 */
export function createLlmProvider({
  preferLive = true,
  model = undefined,
  fetchImpl = null,
  allowDemo = !isProductionRuntime(),
} = {}) {
  const hasKey = Boolean(String(process.env.OPENAI_API_KEY ?? "").trim());
  if (preferLive && hasKey) {
    return new OpenAIProvider({ mode: "live", model, fetchImpl });
  }
  if (!allowDemo) {
    throw new Error("OPENAI_API_KEY is required in production (demo LLM drafts are disabled).");
  }
  return new OpenAIProvider({ mode: "demo", model, fetchImpl });
}

export function llmIsLiveAvailable() {
  return Boolean(String(process.env.OPENAI_API_KEY ?? "").trim());
}
