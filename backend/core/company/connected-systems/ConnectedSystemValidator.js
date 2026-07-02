import { createConnectedSystem } from "./ConnectedSystem.js";

export function validateConnectedSystem(input) {
  // Deterministic: the validator is the model constructor.
  return createConnectedSystem(input);
}

