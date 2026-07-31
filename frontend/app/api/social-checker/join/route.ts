import { NextResponse } from "next/server";

import { platformStore } from "@/lib/server/compose";
import { hashPassword } from "../../../../../backend/core/platform/services/AuthCredentialService.js";
import { MEMBERSHIP_ROLES } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import { businessGrantsSocialCheckerAccess } from "../../../../../backend/core/platform/packages/socialCheckerEntitlement.js";
import { readPurchasedPackagesFromConfig } from "../../../../../backend/core/platform/packages/SalesPackageCatalog.js";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const companyName = String(body.companyName ?? "").trim();
    const password = String(body.password ?? "");
    const organizationCode = String(body.organizationCode ?? "").trim().toUpperCase();
    if (!name || !email || !companyName || password.length < 8 || !organizationCode) {
      return NextResponse.json(
        { ok: false, error: "Name, email, company, password, and organization code are required." },
        { status: 400 },
      );
    }

    const businesses = typeof platformStore.listBusinesses === "function"
      ? await platformStore.listBusinesses().catch(() => [])
      : [];
    // Prefer SQL when available
    let business = null as any;
    if (typeof (platformStore as any).withClient === "function") {
      try {
        const { rows } = await (platformStore as any).withClient((client: any) =>
          client.query(
            `SELECT * FROM businesses
             WHERE UPPER(package_configuration->>'organizationCode') = $1
             LIMIT 1`,
            [organizationCode],
          ),
        );
        business = rows?.[0] ? {
          id: rows[0].id,
          name: rows[0].name,
          packageConfiguration: typeof rows[0].package_configuration === "string"
            ? JSON.parse(rows[0].package_configuration)
            : rows[0].package_configuration,
        } : null;
      } catch {
        business = null;
      }
    }
    if (!business && Array.isArray(businesses)) {
      business = businesses.find((b: any) => {
        const code = String(b?.packageConfiguration?.organizationCode ?? "").toUpperCase();
        return code === organizationCode;
      }) ?? null;
    }
    if (!business) {
      return NextResponse.json({ ok: false, error: "Organization code not found." }, { status: 404 });
    }

    const pkgs = readPurchasedPackagesFromConfig(business.packageConfiguration ?? {});
    if (!businessGrantsSocialCheckerAccess(pkgs)) {
      return NextResponse.json(
        { ok: false, error: "That organization is not entitled to Social Checker." },
        { status: 403 },
      );
    }

    let user = await platformStore.getUserByEmail(email).catch(() => null);
    if (!user) {
      const passwordHash = await hashPassword(password);
      user = await platformStore.createUser({ email, name, passwordHash });
    }

    await platformStore.createMembership({
      userId: user.id,
      businessId: business.id,
      role: MEMBERSHIP_ROLES.EMPLOYEE,
    });

    return NextResponse.json({
      ok: true,
      businessId: business.id,
      organizationName: business.name ?? companyName,
      loginUrl: "/login?callbackUrl=%2Fsocial-checker",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Join failed" },
      { status: 500 },
    );
  }
}
