const TEST_EMAIL_PATTERN = /@test\.(local|vibetech\.local)$/i;
const TEST_BUSINESS_NAME_PATTERN =
  /^(Journey Co|Test Co|Invite Co|Accept Co|Revoke Co|Team Co|Other Co|Browser Test Co|Business [AB]) /;

export function isTestEmail(email) {
  return TEST_EMAIL_PATTERN.test(String(email ?? "").trim());
}

export function isLikelyAutomatedTestBusiness({ name, ownerInviteEmail = null }) {
  const businessName = String(name ?? "").trim();
  if (ownerInviteEmail && isTestEmail(ownerInviteEmail)) return true;
  if (TEST_BUSINESS_NAME_PATTERN.test(businessName)) return true;
  if (/\s\d{10,}$/.test(businessName)) return true;
  return false;
}
