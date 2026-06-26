/**
 * DraftGenerator
 *
 * Sprint 8 — Draft Generator (orchestration only)
 *
 * This component coordinates prompt + draft generation using:
 * - RuntimePipeline
 * - PromptLoader
 * - PromptBuilder
 * - LLMProvider
 *
 * It contains NO business logic, NO decision logic, NO provider-specific logic.
 * It also performs NO side effects (no execution, no sending, no approvals).
 *
 * Dependency injection is required via the constructor.
 */

export class DraftGenerator {
  /**
   * @param {object} params
   * @param {object} params.runtimePipeline
   * @param {object} params.promptLoader
   * @param {object} params.promptBuilder
   * @param {object} params.llmProvider
   */
  constructor({ runtimePipeline, promptLoader, promptBuilder, llmProvider } = {}) {
    if (!runtimePipeline) throw new Error("DraftGenerator requires runtimePipeline.");
    if (!promptLoader) throw new Error("DraftGenerator requires promptLoader.");
    if (!promptBuilder) throw new Error("DraftGenerator requires promptBuilder.");
    if (!llmProvider) throw new Error("DraftGenerator requires llmProvider.");

    this.runtimePipeline = runtimePipeline;
    this.promptLoader = promptLoader;
    this.promptBuilder = promptBuilder;
    this.llmProvider = llmProvider;
  }

  /**
   * @param {object} input
   * @param {any} input.runtimeInput - Input forwarded to RuntimePipeline.run()
   * @param {string} input.employeeFolderPath - Absolute path to employee folder containing prompt.md/TRAINING/rules/employee.json
   * @param {string} [input.attorneyNote]
   * @param {string} [input.clientName]
   * @returns {Promise<{ runtime: any, prompt: string, draft: string }>}
   */
  async generate(input) {
    const runtimeInput = input?.runtimeInput ?? {};
    const employeeFolderPath = input?.employeeFolderPath;
    const attorneyNote = input?.attorneyNote ?? "";
    const clientName = input?.clientName ?? "";

    if (!employeeFolderPath || typeof employeeFolderPath !== "string") {
      throw new Error("DraftGenerator requires input.employeeFolderPath (string).");
    }

    // 1) Run RuntimePipeline (classification → decision → plan)
    const runtime = await this.runtimePipeline.run(runtimeInput);

    // 2) Load employee artifacts from folder
    const employeeArtifacts = await this.promptLoader.load({ employeeFolderPath });

    // 3) Build prompt for LLM providers
    const { prompt } = this.promptBuilder.build({
      runtimeResult: runtime,
      employeeArtifacts,
      attorneyNote,
      clientName,
    });

    // 4) Generate draft using injected LLMProvider
    const draft = await this.llmProvider.generate(prompt);

    return {
      runtime,
      prompt,
      draft: String(draft),
    };
  }
}

