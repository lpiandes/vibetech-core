/**
 * Next.js production composition root.
 *
 * All infrastructure (db, store, delivery, durable services) is wired here once.
 * Route/page code must import from this module (or thin re-exports) — never from
 * backend infrastructure singletons (platformStore.js, pool.js, delivery/*, etc.).
 */
import { PostgresPlatformStore } from "../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import { PostgresWorkspacePersistence } from "../../../backend/core/persistence/PostgresWorkspacePersistence.js";
import { setWorkspacePersistence } from "../../../backend/core/persistence/createWorkspacePersistence.js";
import { createInvitationService, validateInvitationForDisplay, buildInvitationUrl } from "../../../backend/core/platform/services/InvitationService.js";
import { createAuthorizationService } from "../../../backend/core/platform/createAuthorizationService.js";
import { AuthorizationError } from "../../../backend/core/platform/AuthorizationError.js";
import { createDurableSupportAccessService } from "../../../backend/core/platform/support/SupportAccessService.js";
import { createDurableAccessRequestService } from "../../../backend/core/access-requests/AccessRequestService.js";
import { createBusinessKnowledgeService } from "../../../backend/core/platform/knowledge/BusinessKnowledgeService.js";
import { LocalFilesystemKnowledgeStorage } from "../../../backend/core/platform/knowledge/LocalFilesystemKnowledgeStorage.js";
import { createBusinessCampaignTemplateService } from "../../../backend/core/platform/campaigns/BusinessCampaignTemplateService.js";
import { createPlatformBusinessService } from "../../../backend/core/platform/services/PlatformBusinessService.js";
import { createDemoWorkspaceProvisioner } from "../../../backend/core/platform/DemoWorkspaceProvisioner.js";
import { createDevInvitationService } from "../../../backend/core/platform/services/DevInvitationService.js";
import {
  recordDevInvitation as recordDevInvitationImpl,
  getDevInvitationLink as getDevInvitationLinkImpl,
  listDevInvitationLinks as listDevInvitationLinksImpl,
  removeDevInvitationLink as removeDevInvitationLinkImpl,
} from "../../../backend/core/platform/services/DevInvitationMailbox.js";
import { createImportRunRepository } from "../../../backend/core/import/persistence/ImportRunRepository.js";
import { createImportArtifactStore } from "../../../backend/core/import/storage/ImportArtifactStore.js";
import { LocalFilesystemImportStorage } from "../../../backend/core/import/storage/LocalFilesystemImportStorage.js";
import { createCrmImportOrchestrationService } from "../../../backend/core/import/CrmImportOrchestrationService.js";

import {
  withClient as dbWithClient,
  getPool as dbGetPool,
  closePool as dbClosePool,
  getDatabaseUrl as dbGetDatabaseUrl,
} from "@/lib/server/db";
import {
  authenticateUser as authenticateUserImpl,
  hashPassword as hashPasswordImpl,
  verifyPassword as verifyPasswordImpl,
} from "@/lib/server/authCredentials";
import { createFrontendInvitationDeliveryProvider } from "@/lib/server/invitationDelivery";

export type ServerComposition = ReturnType<typeof composeServer>;

function composeServer() {
  const platformStore = new PostgresPlatformStore(dbWithClient);
  setWorkspacePersistence(new PostgresWorkspacePersistence(dbWithClient));

  const invitationDeliveryProvider = createFrontendInvitationDeliveryProvider();
  const invitationService = createInvitationService({
    store: platformStore,
    deliveryProvider: invitationDeliveryProvider,
    recordDevInvitation: recordDevInvitationImpl,
  });

  const supportAccessService = createDurableSupportAccessService(platformStore);
  const authorizationService = createAuthorizationService({
    store: platformStore,
    supportAccessService,
  });

  const accessRequestService = createDurableAccessRequestService(platformStore);
  const businessKnowledgeService = createBusinessKnowledgeService({
    store: platformStore,
    storage: new LocalFilesystemKnowledgeStorage(),
  });
  const businessCampaignTemplateService = createBusinessCampaignTemplateService({
    store: platformStore,
  });

  const platformBusinessService = createPlatformBusinessService({
    store: platformStore,
    createAndDeliverInvitation: invitationService.createAndDeliverInvitation,
  });

  const demoWorkspaceProvisioner = createDemoWorkspaceProvisioner({ store: platformStore });
  const devInvitationService = createDevInvitationService({
    store: platformStore,
    createAndDeliverInvitation: invitationService.createAndDeliverInvitation,
  });

  const importRunRepository = createImportRunRepository({ store: platformStore });
  const importArtifactStore = createImportArtifactStore({
    store: platformStore,
    storage: new LocalFilesystemImportStorage(),
  });
  const crmImportOrchestrationService = createCrmImportOrchestrationService({
    repository: importRunRepository,
    artifactStore: importArtifactStore,
  });

  return {
    withClient: dbWithClient,
    getPool: dbGetPool,
    closePool: dbClosePool,
    getDatabaseUrl: dbGetDatabaseUrl,
    platformStore,
    invitationDeliveryProvider,
    invitationService,
    createAndDeliverInvitation: invitationService.createAndDeliverInvitation,
    resendPendingInvitation: invitationService.resendPendingInvitation,
    validateInvitationForDisplay,
    buildInvitationUrl,
    authorizeBusinessAccess: authorizationService.authorizeBusinessAccess,
    authorizePlatformAdmin: authorizationService.authorizePlatformAdmin,
    AuthorizationError,
    supportAccessService,
    accessRequestService,
    businessKnowledgeService,
    businessCampaignTemplateService,
    createBusinessWithOwnerInvite: platformBusinessService.createBusinessWithOwnerInvite,
    provisionEmptyBusinessWorkspace: platformBusinessService.provisionEmptyBusinessWorkspace,
    createHorizonDemoBusiness: demoWorkspaceProvisioner.createHorizonDemoBusiness,
    listDevelopmentInvitations: devInvitationService.listDevelopmentInvitations,
    generateDevelopmentInvitationLink: devInvitationService.generateDevelopmentInvitationLink,
    recordDevInvitation: recordDevInvitationImpl,
    getDevInvitationLink: getDevInvitationLinkImpl,
    listDevInvitationLinks: listDevInvitationLinksImpl,
    removeDevInvitationLink: removeDevInvitationLinkImpl,
    crmImportOrchestrationService,
    authenticateUser: authenticateUserImpl,
    hashPassword: hashPasswordImpl,
    verifyPassword: verifyPasswordImpl,
  };
}

let cached: ServerComposition | null = null;

export function getServerComposition(): ServerComposition {
  if (!cached) cached = composeServer();
  return cached;
}

/** Convenience re-exports for route/page imports */
export const server = new Proxy({} as ServerComposition, {
  get(_target, prop, receiver) {
    return Reflect.get(getServerComposition(), prop, receiver);
  },
});

export function getPlatformStore() {
  return getServerComposition().platformStore;
}

export const platformStore = new Proxy({} as PostgresPlatformStore, {
  get(_target, prop, receiver) {
    const store = getServerComposition().platformStore as object;
    const value = Reflect.get(store, prop, receiver);
    return typeof value === "function" ? value.bind(store) : value;
  },
});

export async function withClient<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  return getServerComposition().withClient(fn);
}

export function getPool() {
  return getServerComposition().getPool();
}

export function closePool() {
  return getServerComposition().closePool();
}

export function getDatabaseUrl() {
  return getServerComposition().getDatabaseUrl();
}

export function authenticateUser(email: string, password: string) {
  return getServerComposition().authenticateUser(email, password);
}

export function hashPassword(password: string) {
  return getServerComposition().hashPassword(password);
}

export function verifyPassword(password: string, passwordHash: string | null | undefined) {
  return getServerComposition().verifyPassword(password, passwordHash);
}

export function createAndDeliverInvitation(input: any) {
  return getServerComposition().createAndDeliverInvitation(input);
}

export function resendPendingInvitation(input: any) {
  return getServerComposition().resendPendingInvitation(input);
}

export function authorizeBusinessAccess(input: any) {
  return getServerComposition().authorizeBusinessAccess(input);
}

export function authorizePlatformAdmin(input: any) {
  return getServerComposition().authorizePlatformAdmin(input);
}

export function createBusinessWithOwnerInvite(input: any) {
  return getServerComposition().createBusinessWithOwnerInvite(input);
}

export function createHorizonDemoBusiness(input?: any) {
  return getServerComposition().createHorizonDemoBusiness(input);
}

export function listDevelopmentInvitations(input?: any) {
  return getServerComposition().listDevelopmentInvitations(input);
}

export function generateDevelopmentInvitationLink(input: any) {
  return getServerComposition().generateDevelopmentInvitationLink(input);
}

export function getDevInvitationLink(invitationId: string) {
  return getServerComposition().getDevInvitationLink(invitationId);
}

export function removeDevInvitationLink(invitationId: string) {
  return getServerComposition().removeDevInvitationLink(invitationId);
}

export function recordDevInvitation(input: any) {
  return getServerComposition().recordDevInvitation(input);
}

export function listDevInvitationLinks() {
  return getServerComposition().listDevInvitationLinks();
}

export const businessKnowledgeService = new Proxy({} as ServerComposition["businessKnowledgeService"], {
  get(_t, prop, receiver) {
    const svc = getServerComposition().businessKnowledgeService as object;
    const value = Reflect.get(svc, prop, receiver);
    return typeof value === "function" ? value.bind(svc) : value;
  },
});

export const businessCampaignTemplateService = new Proxy({} as ServerComposition["businessCampaignTemplateService"], {
  get(_t, prop, receiver) {
    const svc = getServerComposition().businessCampaignTemplateService as object;
    const value = Reflect.get(svc, prop, receiver);
    return typeof value === "function" ? value.bind(svc) : value;
  },
});

export const crmImportOrchestrationService = new Proxy({} as ServerComposition["crmImportOrchestrationService"], {
  get(_t, prop, receiver) {
    const svc = getServerComposition().crmImportOrchestrationService as object;
    const value = Reflect.get(svc, prop, receiver);
    return typeof value === "function" ? value.bind(svc) : value;
  },
});

export const accessRequestService = new Proxy({} as ServerComposition["accessRequestService"], {
  get(_t, prop, receiver) {
    const svc = getServerComposition().accessRequestService as object;
    const value = Reflect.get(svc, prop, receiver);
    return typeof value === "function" ? value.bind(svc) : value;
  },
});

export const supportAccessService = new Proxy({} as ServerComposition["supportAccessService"], {
  get(_t, prop, receiver) {
    const svc = getServerComposition().supportAccessService as object;
    const value = Reflect.get(svc, prop, receiver);
    return typeof value === "function" ? value.bind(svc) : value;
  },
});

export { validateInvitationForDisplay, buildInvitationUrl, AuthorizationError };
