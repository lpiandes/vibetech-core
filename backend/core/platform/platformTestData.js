const TEST_EMAIL_PATTERN = /@test\.(local|vibetech\.local)$/i;
const TEST_BUSINESS_NAME_PATTERN =
  /^(Journey Co|Test Co|Invite Co|Accept Co|Revoke Co|Team Co|Other Co|Browser Test Co|Business [AB]|Pilot Co|Migration Verify Co|Verify Co|Smoke Co|Nav Test Workspace|Co)(\s|$)/i;

export function isTestEmail(email) {
  return TEST_EMAIL_PATTERN.test(String(email ?? "").trim());
}

export function isLikelyAutomatedTestBusiness({ name, ownerInviteEmail = null }) {
  const businessName = String(name ?? "").trim();
  if (!businessName && !ownerInviteEmail) return false;
  if (ownerInviteEmail && isTestEmail(ownerInviteEmail)) return true;
  if (TEST_BUSINESS_NAME_PATTERN.test(businessName)) return true;
  // Scripted pilot / migration names ending in long numeric suffixes
  if (/\s\d{10,}$/.test(businessName)) return true;
  if (/migration|verify co|smoke test|e2e |nav test/i.test(businessName)) return true;
  // Incomplete / placeholder names from aborted creates
  if (/^(co|company|business|untitled|test)$/i.test(businessName)) return true;
  return false;
}
