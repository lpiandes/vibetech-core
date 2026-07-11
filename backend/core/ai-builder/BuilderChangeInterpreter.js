import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { getDefaultBuilderIntelligenceProvider } from "./BuilderIntelligenceProvider.js";

export class BuilderChangeInterpreter {
  constructor({ intelligence = getDefaultBuilderIntelligenceProvider() } = {}) {
    this.intelligence = intelligence;
  }

  async interpret(text) {
    const interpreted = await this.intelligence.interpretChangeRequest({ text });
    return deepFreeze(interpreted);
  }
}
