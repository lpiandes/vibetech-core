/**
 * Self-serve FE Retention signup: user + book, then Stripe Checkout.
 * Admins do not assign this package.
 *
 * Retrying signup with the same email/password resumes the existing book
 * instead of trapping the agent on "already signed up."
 */
import crypto from "node:crypto";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { MEMBERSHIP_ROLES } from "../platform/permissions/rolePermissions.js";
import {
  FE_RETENTION_CRM_PACKAGE_ID,
  listOwnedFeRetentionBooks,
} from "./feRetentionEntitlement.js";
import { readFeRetentionBilling, writeFeRetentionBilling } from "./FeRetentionBilling.js";
import { isValidVibeKeepPromoCode } from "./vibeKeepPromo.js";
import { ensureFeRetentionInstallation } from "./ensureFeRetentionInstallation.js";
import { provisionEmptyBusinessWorkspace } from "../platform/services/PlatformBusinessService.js";

export const EMAIL_TAKEN_MESSAGE = "An account with that email already exists. Log in instead.";

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

function isUniqueEmailError(err) {
  const code = String(err?.code ?? "");
  const message = String(err?.message ?? err ?? "");
  return code === "23505" || /duplicate key|unique constraint|already exists/i.test(message);
}

function signupResult({ user, business, complimentary, resumed }) {
  const billing = readFeRetentionBilling(business?.packageConfiguration ?? {});
  return deepFreeze({
    ok: true,
    userId: user.id,
    businessId: String(business.id),
    email: String(user.email ?? ""),
    packageId: FE_RETENTION_CRM_PACKAGE_ID,
    complimentary: Boolean(complimentary) || billing.status === "complimentary",
    resumed: Boolean(resumed),
    allowsDashboard: billing.allowsDashboard,
  });
}

export async function attachFeRetentionBook({
  platformStore,
  user,
  agencyName,
  complimentary = false,
  putDurableCredential = null,
  vault = null,
} = {}) {
  const packageConfiguration = writeFeRetentionBilling({}, {
    status: complimentary ? "complimentary" : "incomplete",
  });
  const business = await platformStore.createBusiness({
    id: crypto.randomUUID(),
    name: String(agencyName ?? "").trim() || "Agency",
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
  return business;
}

async function ownedFeBooks(platformStore, userId) {
  const businesses = await platformStore.listBusinessesForUser(userId).catch(() => []);
  return listOwnedFeRetentionBooks(businesses);
}

export async function resumeFeRetentionSignup({
  platformStore,
  user,
  password,
  agencyName,
  complimentary = false,
  verifyPassword,
  putDurableCredential = null,
  vault = null,
} = {}) {
  const hash = user?.passwordHash ?? user?.password_hash ?? null;
  const matches = typeof verifyPassword === "function" && hash
    ? await verifyPassword(password, hash)
    : false;
  if (!matches) {
    return deepFreeze({
      ok: false,
      reason: "email_taken",
      message: EMAIL_TAKEN_MESSAGE,
    });
  }

  const books = await ownedFeBooks(platformStore, user.id);
  if (books.length) {
    const unpaid = books.find((row) => !readFeRetentionBilling(row.packageConfiguration ?? {}).allowsDashboard);
    const business = unpaid || books[0];
    let config = business.packageConfiguration ?? {};
    const billing = readFeRetentionBilling(config);
    if (complimentary && !billing.allowsDashboard && typeof platformStore.updateBusinessPackageConfiguration === "function") {
      config = writeFeRetentionBilling(config, { status: "complimentary" });
      await platformStore.updateBusinessPackageConfiguration({
        businessId: business.id,
        packageConfiguration: config,
      });
      business.packageConfiguration = config;
    }
    return signupResult({ user, business, complimentary, resumed: true });
  }

  const business = await attachFeRetentionBook({
    platformStore,
    user,
    agencyName,
    complimentary,
    putDurableCredential,
    vault,
  });
  return signupResult({ user, business, complimentary, resumed: true });
}

export async function provisionFeRetentionAccount({
  platformStore,
  hashPassword,
  verifyPassword,
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

  const resumeArgs = {
    platformStore,
    password: valid.password,
    agencyName: valid.agencyName,
    complimentary,
    verifyPassword,
    putDurableCredential,
    vault,
  };

  const existing = await platformStore.getUserByEmail(valid.email).catch(() => null);
  if (existing) {
    return resumeFeRetentionSignup({ ...resumeArgs, user: existing });
  }

  const passwordHash = await hashPassword(valid.password);
  let user;
  try {
    user = await platformStore.createUser({
      email: valid.email,
      name: valid.personName,
      passwordHash,
    });
  } catch (err) {
    if (!isUniqueEmailError(err)) throw err;
    const raced = await platformStore.getUserByEmail(valid.email).catch(() => null);
    if (!raced) throw err;
    return resumeFeRetentionSignup({ ...resumeArgs, user: raced });
  }

  const business = await attachFeRetentionBook({
    platformStore,
    user,
    agencyName: valid.agencyName,
    complimentary,
    putDurableCredential,
    vault,
  });

  return signupResult({ user, business, complimentary, resumed: false });
}
