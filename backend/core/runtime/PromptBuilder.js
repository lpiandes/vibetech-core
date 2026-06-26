/**
 * PromptBuilder
 *
 * Sprint 7A (Runtime MVP) component:
 * - Assembles a single prompt string for a Digital Employee.
 * - Does NOT call any AI providers.
 * - Does NOT execute anything.
 * - Does NOT rewrite employee artifacts.
 * - Performs deterministic string assembly only.
 */

export class PromptBuilder {
  constructor() {}

  /**
   * @param {object} input
   * @param {object} input.runtimeResult - RuntimePipeline output fields.
   * @param {object} input.employeeArtifacts
   * @param {string} input.employeeArtifacts.prompt
   * @param {string} input.employeeArtifacts.training
   * @param {any} input.employeeArtifacts.rules
   * @param {any} input.employeeArtifacts.employee
   * @param {string} input.attorneyNote
   * @param {string} input.clientName
   *
   * @returns {{ prompt: string }}
   */
  build({ runtimeResult, employeeArtifacts, attorneyNote, clientName }) {
    const prompt = this.#assemble({
      runtimeResult,
      employeeArtifacts,
      attorneyNote,
      clientName,
    });

    return { prompt };
  }

  #assemble({ runtimeResult, employeeArtifacts, attorneyNote, clientName }) {
    const employeePrompt = String(employeeArtifacts?.prompt ?? "");
    const training = String(employeeArtifacts?.training ?? "");
    const rules = employeeArtifacts?.rules ?? null;
    const employee = employeeArtifacts?.employee ?? null;

    const runtimeJson = JSON.stringify(runtimeResult ?? {}, null, 2);
    const rulesJson = JSON.stringify(rules, null, 2);
    const employeeJson = JSON.stringify(employee, null, 2);

    // Important: deterministic assembly only. No rewriting of any artifact contents.
    return [
      "## SYSTEM: Employee Operating Manual",
      employeePrompt,
      "",
      "## SYSTEM: Training",
      training,
      "",
      "## SYSTEM: Rules (JSON)",
      rulesJson,
      "",
      "## CONTEXT: Employee Metadata (JSON)",
      employeeJson,
      "",
      "## CONTEXT: Runtime Result (JSON)",
      runtimeJson,
      "",
      "## ATTORNEY NOTE",
      String(attorneyNote ?? ""),
      "",
      "## CLIENT NAME",
      String(clientName ?? ""),
    ].join("\n");
  }
}

