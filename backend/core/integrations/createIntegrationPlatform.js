import { IntegrationProviderRegistry } from "./providers/IntegrationProviderRegistry.js";
import { ConnectionRuntime } from "./connections/ConnectionRuntime.js";
import { createMockCredentialResolver } from "./credentials/MockCredentialResolver.js";
import { MockEmailIntegrationProvider } from "./fixtures/MockEmailIntegrationProvider.js";
import { MockSmsIntegrationProvider } from "./fixtures/MockSmsIntegrationProvider.js";
import { MockExternalSystemIntegrationProvider } from "./fixtures/MockExternalSystemIntegrationProvider.js";
import { MockFormSubmissionProvider } from "./fixtures/MockFormSubmissionProvider.js";
import { MockVoiceProvider } from "./fixtures/MockVoiceProvider.js";
import { GmailIntegrationAdapterStub } from "./adapters/GmailIntegrationAdapterStub.js";
import { ConnectionService } from "./use-cases/ConnectionService.js";
import { ExternalActionOrchestrationService } from "./actions/ExternalActionOrchestrationService.js";
import { CommunicationActionService } from "./use-cases/CommunicationActionService.js";
import { WebhookIngressService } from "./inbound/WebhookIngressService.js";
import { IntegrationPlatformEventPublisher } from "./events/IntegrationPlatformEventPublisher.js";
import { CommunicationPlatformEventPublisher } from "../communications/events/CommunicationPlatformEventPublisher.js";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Default mock providers for workspace activation.
 * Gmail (googleapis) must be injected by the composition root when needed —
 * never imported here so Next.js does not pull googleapis into the server graph.
 */
export function createDefaultIntegrationProviderRegistry({ nowISO, extraProviders = [] } = {}) {
  const registry = new IntegrationProviderRegistry();
  registry.register(new MockEmailIntegrationProvider({ nowISO }));
  registry.register(new MockSmsIntegrationProvider({ nowISO }));
  registry.register(new MockExternalSystemIntegrationProvider({ nowISO }));
  registry.register(new MockFormSubmissionProvider({ nowISO }));
  registry.register(new MockVoiceProvider({ nowISO }));
  registry.register(new GmailIntegrationAdapterStub({ nowISO }));
  for (const provider of extraProviders) {
    registry.register(provider);
  }
  return registry;
}

export function createIntegrationPlatform({
  workspaceId,
  installationResult,
  communicationRuntime,
  communicationPreferenceRuntime = null,
  connectionRuntimeSeed = null,
  nowISO = "2026-07-01T00:00:00.000Z",
  platformEventPublisher = null,
  platformEventBus = null,
  platformEventStore = null,
  extraProviders = [],
} = {}) {
  const effectiveWorkspaceId = String(workspaceId ?? "default");
  const connectionRuntime = connectionRuntimeSeed
    ? new ConnectionRuntime({ seed: () => connectionRuntimeSeed })
    : new ConnectionRuntime();
  const providerRegistry = createDefaultIntegrationProviderRegistry({ nowISO, extraProviders });
  const credentialResolver = createMockCredentialResolver();
  const integrationPlatformEventPublisher =
    platformEventPublisher ??
    (platformEventBus || platformEventStore
      ? new IntegrationPlatformEventPublisher({
          platformEventBus: platformEventBus ?? null,
          platformEventStore: platformEventStore ?? null,
          nowISO,
        })
      : null);

  const communicationPlatformEventPublisher =
    platformEventBus || platformEventStore
      ? new CommunicationPlatformEventPublisher({
          platformEventBus: platformEventBus ?? null,
          platformEventStore: platformEventStore ?? null,
          nowISO,
        })
      : null;

  const connectionService = new ConnectionService({
    connectionRuntime,
    providerRegistry,
    integrationPlatformEventPublisher,
    nowISO,
  });

  for (const req of installationResult?.connectedSystemRequirements ?? []) {
    connectionService.registerRequirement({
      workspaceId: effectiveWorkspaceId,
      connectionType: req.id,
      displayName: req.displayName,
    });
  }

  const actionOrchestrator = new ExternalActionOrchestrationService({
    connectionRuntime,
    providerRegistry,
    credentialResolver,
    communicationRuntime,
    preferenceRuntime: communicationPreferenceRuntime,
    integrationPlatformEventPublisher,
    communicationPlatformEventPublisher,
    nowISO,
  });

  const communicationActionService = new CommunicationActionService({ actionOrchestrator, nowISO });
  const webhookIngressService = new WebhookIngressService({
    providerRegistry,
    platformEventPublisher: integrationPlatformEventPublisher,
    workspaceId: effectiveWorkspaceId,
    nowISO,
  });

  return {
    connectionRuntime,
    providerRegistry,
    credentialResolver,
    connectionService,
    actionOrchestrator,
    communicationActionService,
    webhookIngressService,
    integrationPlatformEventPublisher,
  };
}
