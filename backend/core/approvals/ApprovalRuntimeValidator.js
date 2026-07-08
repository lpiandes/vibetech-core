function fail(message) {
  throw new Error(`ApprovalRuntimeValidator: ${message}`);
}

export function validateApprovalRuntime(runtime) {
  if (!runtime || typeof runtime !== "object") fail("runtime required.");
  const st = runtime._state;
  if (!st || typeof st !== "object") fail("runtime._state required.");
  if (!Object.isFrozen(st)) fail("runtime._state must be frozen.");
  if (!Array.isArray(st.requests)) fail("runtime._state.requests must be array.");
  if (!st.metrics || typeof st.metrics !== "object") fail("runtime._state.metrics required.");
  return true;
}
