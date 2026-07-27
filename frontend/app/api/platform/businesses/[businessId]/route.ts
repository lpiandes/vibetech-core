import { NextResponse } from "next/server";

import { platformStore } from "@/lib/server/compose";
import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

type Params = { params: Promise<{ businessId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePlatformAdminApi();
    const { businessId } = await params;
    const body = await request.json().catch(() => ({}));
    const existing = await platformStore.getBusinessById(businessId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Business not found." }, { status: 404 });
    }

    let business = existing;
    const name = body?.name != null ? String(body.name).trim() : null;
    if (name) {
      business = await platformStore.updateBusinessName({ businessId, name });
    }

    if (body?.purchasedPackages !== undefined) {
      const {
        applyPurchasedPackagesChange,
        normalizePurchasedPackages,
        readPendingPackageAsk,
      } = await import("../../../../../../backend/core/platform/packages/SalesPackageCatalog.js");
      const { syncPurchasedPackagesOntoInstallation } = await import(
        "../../../../../../backend/core/platform/packages/syncPurchasedPackagesOntoInstallation.js"
      );
      const packages = normalizePurchasedPackages(body.purchasedPackages);
      if (!packages.length) {
        return NextResponse.json(
          { ok: false, error: "Select at least one purchased package." },
          { status: 400 },
        );
      }
      // Plain clone — never persist a frozen object tree.
      let packageConfiguration = JSON.parse(JSON.stringify(
        applyPurchasedPackagesChange(
          existing.packageConfiguration ?? {},
          packages,
        ),
      ));

      const installationSync = await syncPurchasedPackagesOntoInstallation({
        platformStore,
        businessId,
        purchasedPackages: packages,
        packageConfiguration,
        actorId: "platform_admin",
        ensurePendingAsk: true,
      });

      // Sync may restore pending Ask when employees were missing from a prior broken save.
      if (
        installationSync?.pendingPackageAsk
        && !readPendingPackageAsk(packageConfiguration)
      ) {
        packageConfiguration = {
          ...packageConfiguration,
          pendingPackageAsk: installationSync.pendingPackageAsk,
        };
      }

      business = await platformStore.updateBusinessPackageConfiguration({
        businessId,
        packageConfiguration,
      });

      return NextResponse.json({
        ok: true,
        business,
        pendingPackageAsk: readPendingPackageAsk(packageConfiguration),
        installationSync: {
          ok: Boolean(installationSync?.ok),
          employeesAdded: Number(installationSync?.added ?? 0),
          packagesInjected: installationSync?.packagesInjected ?? [],
        },
      });
    }

    if (!name && body?.purchasedPackages === undefined) {
      return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, business });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requirePlatformAdminApi();
    const { businessId } = await params;
    const existing = await platformStore.getBusinessById(businessId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Business not found." }, { status: 404 });
    }
    const business = await platformStore.archiveBusiness({ businessId });
    return NextResponse.json({
      ok: true,
      business,
      message: "Business archived. It no longer appears in active directories.",
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
