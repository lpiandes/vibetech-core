/**
 * Self-serve FE Retention signup: user + book, then Stripe Checkout.
 * Admins do not assign this package.
 */
import crypto from "node:crypto";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { MEMBERSHIP_ROLES } from "../platform/permissions/rolePermissions.js";
import { FE_RETENTION_CRM_PACKAGE_ID } from "./feRetentionEntitlement.js";
import { writeFeRetentionBilling } from "./FeRetentionBilling.js";
import { isValidVibeKeepPromoCode } from "./vibeKeepPromo.js";
import { ensureFeRetentionInstallation } from "./ensureFeRetentionInstallation.js";
import { provisionEmptyBusinessWorkspace } from "../platform/services/PlatformBusinessService.js";

export function validateFeRetentionSignup({ name, email, password, agencyName } = {}) {
  const personName = String(name ?? "").trim();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const bookName = String(agencyName ?? "").trim();
  const pass = String(password ?? "");
  if (!personName || !normalizedEmail.includes("@") || !bookName) {
    return { ok: false, message: "Name, email, and agency name are required." };
  }
  if (pass.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  return { ok: true, personName, email: normalizedEmail, password: pass, agencyName: bookName };
}

export async function provisionFeRetentionAccount({
  platformStore,
  hashPassword,
  name,
  email,
  password,
  agencyName,
  putDurableCredential = null,
  vault = null,
  promoCode = "",
} = {}) {
  const valid = validateFeRetentionSignup({ name, email, password, agencyName });
  if (!valid.ok) return deepFreeze(valid);

  const typedPromo = String(promoCode ?? "").trim();
  const complimentary = Boolean(typedPromo) && isValidVibeKeepPromoCode(typedPromo);
  if (typedPromo && !complimentary) {
    return deepFreeze({
      ok: false,
      reason: "invalid_promo",
      message: "That promo code is not valid.",
    });
  }

  const existing = await platformStore.getUserByEmail(valid.email).catch(() => null);
  if (existing) {
    return deepFreeze({
      ok: false,
      reason: "email_taken",
      message: "An account with that email already exists. Log in instead.",
    });
  }

  const passwordHash = await hashPassword(valid.password);
  const user = await platformStore.createUser({
    email: valid.email,
    name: valid.personName,
    passwordHash,
  });

  const packageConfiguration = writeFeRetentionBilling({}, {
    status: complimentary ? "complimentary" : "incomplete",
  });
  const business = await platformStore.createBusiness({
    id: crypto.randomUUID(),
    name: valid.agencyName,
    kind: "NORMAL",
    packageConfiguration,
  });
  provisionEmptyBusinessWorkspace(business);
  await platformStore.createMembership({
    userId: user.id,
    businessId: business.id,
    role: MEMBERSHIP_ROLES.OWNER,
  });
  await ensureFeRetentionInstallation({
    platformStore,
    businessId: business.id,
    packageConfiguration,
    actorId: user.id,
    putDurableCredential,
    vault,
    attachSms: false,
  });

  return deepFreeze({
    ok: true,
    userId: user.id,
    businessId: String(business.id),
    email: valid.email,
    packageId: FE_RETENTION_CRM_PACKAGE_ID,
    complimentary,
  });
}
