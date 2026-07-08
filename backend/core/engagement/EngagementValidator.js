function fail(message) {
  throw new Error(`EngagementValidator: ${message}`);
}

export function validateEngagementViewModel(viewModel) {
  if (!viewModel || typeof viewModel !== "object") fail("viewModel required.");
  if (!Object.isFrozen(viewModel)) fail("viewModel must be frozen.");
  if (!viewModel.partyId) fail("partyId required.");
  if (!Array.isArray(viewModel.timeline)) fail("timeline must be array.");
  if (!viewModel.attention || typeof viewModel.attention !== "object") fail("attention required.");
  if (!Array.isArray(viewModel.nextActions)) fail("nextActions must be array.");
  return true;
}
