import { requireSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";
import { presentProductError } from "@/lib/platform/productErrors";
import { PLATFORM_ROLES } from "../../../backend/core/platform/permissions/rolePermissions.js";
import { platformStore } from "@/lib/server/compose";

/**
 * Architect has two entry points: improving a business that already exists,
 * and creating a brand-new one. The latter must work for a signed-in person
 * who has no memberships yet; otherwise the first-business experience is a
 * dead end after an empty install.
 */
export async function requireArchitectActor({ allowNewBusiness = false }: { allowNewBusiness?: boolean } = {}) {
  const user = await requireSessionUser();
  if (user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN) return user;
  const businesses = await platformStore.listBusinessesForUser(user.id);
  for (const business of businesses) {
    const membership = await platformStore.getMembership(user.id, business.id);
    if (membership?.role === "OWNER" || membership?.role === "MANAGER" || membership?.role === "ADMIN") return user;
  }
  if (allowNewBusiness) return user;
  const productError = presentProductError("permission_denied");
  const err = new Error(productError.message) as Error & { status?: number; productError?: typeof productError };
  err.status = 403;
  err.productError = productError;
  throw err;
}

export function architectApiError(error: unknown) {
  const product = (error as any)?.productError ?? presentProductError(error);
  return {
    body: {
      ok: false as const,
      error: product.message,
      productError: product,
    },
    status: (error as any)?.status ?? 500,
  };
}
