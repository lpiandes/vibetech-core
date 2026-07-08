#!/usr/bin/env node
import { createHorizonDemoBusiness } from "../backend/core/platform/DemoWorkspaceProvisioner.js";

const result = await createHorizonDemoBusiness();
console.log("Horizon Properties DEMO workspace created.");
console.log(`  business id: ${result.business.id}`);
console.log(`  workspace id: ${result.business.workspaceId ?? result.business.id}`);
console.log(`  kind: ${result.business.kind}`);
console.log(`  primary party: ${result.activation.demoBootstrap?.primaryPartyId ?? "n/a"}`);
