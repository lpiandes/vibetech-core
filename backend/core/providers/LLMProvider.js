/**
 * LLMProvider
 *
 * Generic provider contract for Large Language Model integrations.
 *
 * IMPORTANT:
 * - This file contains no API calls.
 * - generate(prompt) must be implemented by concrete providers.
 */
export class LLMProvider {
  /**
   * Generate a completion/draft for a given prompt.
   *
   * @param {string} prompt
   * @returns {Promise<string> | string} - Provider may return synchronously or asynchronously.
   */
  generate(prompt) {
    throw new Error("LLMProvider.generate(prompt) not implemented.");
  }
}

