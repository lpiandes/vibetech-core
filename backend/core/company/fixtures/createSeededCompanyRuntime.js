import { CompanyWorkspaceRuntime } from "../CompanyWorkspaceRuntime.js";
import { createABCPropertyGroupSeed } from "./ABCPropertyGroupSeed.js";

/** Explicit legacy fixture runtime for tests that assert seeded company facts. */
export function createSeededCompanyRuntime() {
  return new CompanyWorkspaceRuntime({ seed: createABCPropertyGroupSeed });
}
