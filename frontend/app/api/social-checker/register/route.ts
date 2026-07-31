import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { platformStore } from "@/lib/server/compose";
import { hashPassword } from "../../../../../backend/core/platform/services/AuthCredentialService.js";
import { MEMBERSHIP_ROLES } from "../../../../../backend/core/platform/permissions/rolePermissions.js";

function makeOrgCode() {
  return `VT-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const companyName = String(body.companyName ?? "").trim();
    const password = String(body.password ?? "");
    if (!name || !email || !companyName || password.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Name, email, company, and password (8+ chars) are required." },
        { status: 400 },
      );
    }

    const existing = await platformStore.getUserByEmail(email).catch(() => null);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "An account with that email already exists. Log in instead." },
        { status: 409 },
      );
    }

    const organizationCode = makeOrgCode();
    const passwordHash = await hashPassword(password);
    const user = await platformStore.createUser({
      email,
      name,
      passwordHash,
    });
    const business = await platformStore.createBusiness({
      name: companyName,
      packageConfiguration: {
        purchasedPackages: ["social_background_screening"],
        organizationCode,
        socialCheckerOnly: true,
      },
    });
    await platformStore.createMembership({
      userId: user.id,
      businessId: business.id,
      role: MEMBERSHIP_ROLES.OWNER,
    });

    const origin = new URL(request.url).origin.replace("app.", "social.");
    const joinUrl = `${origin.includes("social.") ? origin : "https://social.vtechdevelopment.com"}/?join=${encodeURIComponent(organizationCode)}`;

    return NextResponse.json({
      ok: true,
      organizationCode,
      businessId: business.id,
      joinUrl,
      loginUrl: "/login?callbackUrl=%2Fsocial-checker",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Register failed" },
      { status: 500 },
    );
  }
}
