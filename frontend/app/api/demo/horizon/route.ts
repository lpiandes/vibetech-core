import { createHorizonDemoBusiness } from "@/lib/server/compose";
import { workspaceCompositionRegistry } from "../../../../lib/workspace/WorkspaceCompositionRegistry.js";
import { HORIZON_WORKSPACE_ID } from "../../../../../backend/core/integration/HorizonDemoBootstrapRegistry.js";
import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST() {
  try {
    await requirePlatformAdminApi();
    workspaceCompositionRegistry.clear(HORIZON_WORKSPACE_ID);
    const result = await createHorizonDemoBusiness();
    return Response.json(
      {
        business: result.business,
        demoBootstrap: {
          primaryPartyId: result.activation.demoBootstrap?.primaryPartyId ?? null,
          primaryRequestId: result.activation.demoBootstrap?.primaryRequestId ?? null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
