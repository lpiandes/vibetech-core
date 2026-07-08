import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { validateIndustryPackage, validateIndustryPackageConfiguration } from "./IndustryPackageValidator.js";
import {
  IndustryPackageInstallationRuntime,
  computeInstallationFingerprint,
  INSTALLATION_STATUSES,
  createIndustryPackageInstallationRecord,
} from "./IndustryPackageInstallationRuntime.js";
import { installPackageCapabilities } from "./install/installPackageCapabilities.js";
import { installPackageKnowledgeCategories } from "./install/installPackageKnowledgeCategories.js";
import { installPackageAutomations } from "./install/installPackageAutomations.js";

function fail(message) {
  throw new Error(`IndustryPackageInstaller: ${message}`);
}

export function createIndustryPackageInstallationResult({
  installationId,
  workspaceId,
  packageId,
  packageVersion,
  configurationFingerprint,
  status,
  installedArtifacts,
  terminology,
  requestTypes,
  workTypes,
  interactionOutcomes,
  employeeDefinitions,
  communicationIntents,
  onboardingSchema,
  connectedSystemRequirements,
  connectionGuidance,
  knowledgeRequirements,
  approvalPolicies,
  subjectTypes,
  qualificationFieldSchemas,
  relationshipTypes,
  lifecycleTransitions,
  relationshipFollowUpRules,
  relationshipFollowUpOutcomes,
  inboundRouting,
  segmentTemplates,
  importProfiles,
  idempotent,
  errors,
} = {}) {
  return deepFreeze({
    installationId: String(installationId ?? ""),
    workspaceId: String(workspaceId ?? ""),
    packageId: String(packageId ?? ""),
    packageVersion: Number(packageVersion ?? 1),
    configurationFingerprint: String(configurationFingerprint ?? ""),
    status: String(status ?? INSTALLATION_STATUSES.INSTALLED),
    installedArtifacts: installedArtifacts && typeof installedArtifacts === "object" ? deepFreeze(installedArtifacts) : deepFreeze({}),
    terminology: terminology && typeof terminology === "object" ? terminology : deepFreeze({}),
    requestTypes: deepFreeze(Array.isArray(requestTypes) ? requestTypes : []),
    workTypes: deepFreeze(Array.isArray(workTypes) ? workTypes : []),
    interactionOutcomes: deepFreeze(Array.isArray(interactionOutcomes) ? interactionOutcomes : []),
    employeeDefinitions: deepFreeze(Array.isArray(employeeDefinitions) ? employeeDefinitions : []),
    communicationIntents: deepFreeze(Array.isArray(communicationIntents) ? communicationIntents : []),
    knowledgeRequirements: deepFreeze(Array.isArray(knowledgeRequirements) ? knowledgeRequirements : []),
    onboardingSchema: onboardingSchema && typeof onboardingSchema === "object" ? onboardingSchema : deepFreeze({}),
    connectedSystemRequirements: deepFreeze(Array.isArray(connectedSystemRequirements) ? connectedSystemRequirements : []),
    connectionGuidance: deepFreeze(Array.isArray(connectionGuidance) ? connectionGuidance : []),
    approvalPolicies: deepFreeze(Array.isArray(approvalPolicies) ? approvalPolicies : []),
    subjectTypes: deepFreeze(Array.isArray(subjectTypes) ? subjectTypes : []),
    qualificationFieldSchemas: deepFreeze(Array.isArray(qualificationFieldSchemas) ? qualificationFieldSchemas : []),
    relationshipTypes: deepFreeze(Array.isArray(relationshipTypes) ? relationshipTypes : []),
    lifecycleTransitions: deepFreeze(Array.isArray(lifecycleTransitions) ? lifecycleTransitions : []),
    relationshipFollowUpRules: deepFreeze(Array.isArray(relationshipFollowUpRules) ? relationshipFollowUpRules : []),
    relationshipFollowUpOutcomes: deepFreeze(Array.isArray(relationshipFollowUpOutcomes) ? relationshipFollowUpOutcomes : []),
    inboundRouting: deepFreeze(Array.isArray(inboundRouting) ? inboundRouting : []),
    segmentTemplates: deepFreeze(Array.isArray(segmentTemplates) ? segmentTemplates : []),
    importProfiles: deepFreeze(Array.isArray(importProfiles) ? importProfiles : []),
    idempotent: Boolean(idempotent),
    errors: deepFreeze(Array.isArray(errors) ? errors.map(String) : []),
  });
}

/**
 * Orchestrates bounded installers. Does not own canonical business state.
 */
export class IndustryPackageInstaller {
  constructor({ installationRuntime } = {}) {
    this.installationRuntime = installationRuntime ?? new IndustryPackageInstallationRuntime();
  }

  install({
    industryPackage,
    workspaceId,
    configuration,
    companyRuntime,
    capabilityRuntime,
    automationRuntime,
    nowISO,
    automationConfigurationOverrides,
  } = {}) {
    validateIndustryPackage(industryPackage);
    validateIndustryPackageConfiguration(configuration);

    if (!workspaceId) fail("workspaceId required.");
    if (!companyRuntime) fail("companyRuntime required.");
    if (!capabilityRuntime) fail("capabilityRuntime required.");
    if (!automationRuntime) fail("automationRuntime required.");

    const timestampISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
    const fingerprint = computeInstallationFingerprint({
      workspaceId,
      packageId: industryPackage.id,
      packageVersion: industryPackage.version,
      configuration: configuration ?? {},
    });

    const existing = this.installationRuntime.getInstallationByFingerprint(fingerprint);
    if (existing) {
      return createIndustryPackageInstallationResult({
        installationId: existing.id,
        workspaceId,
        packageId: industryPackage.id,
        packageVersion: industryPackage.version,
        configurationFingerprint: fingerprint,
        status: existing.status,
        installedArtifacts: existing.installedArtifacts,
        terminology: industryPackage.terminology,
        requestTypes: industryPackage.requestTypes,
        workTypes: industryPackage.workTypes,
        interactionOutcomes: industryPackage.interactionOutcomes,
        employeeDefinitions: industryPackage.employeeDefinitions,
        communicationIntents: industryPackage.communicationIntents,
        knowledgeRequirements: industryPackage.knowledgeRequirements,
        onboardingSchema: industryPackage.onboardingSchema,
        connectedSystemRequirements: industryPackage.connectedSystemRequirements,
        connectionGuidance: industryPackage.connectionGuidance,
        approvalPolicies: industryPackage.approvalPolicies,
        subjectTypes: industryPackage.subjectTypes,
        qualificationFieldSchemas: industryPackage.qualificationFieldSchemas,
        relationshipTypes: industryPackage.relationshipTypes,
        lifecycleTransitions: industryPackage.lifecycleTransitions,
        relationshipFollowUpRules: industryPackage.relationshipFollowUpRules,
        relationshipFollowUpOutcomes: industryPackage.relationshipFollowUpOutcomes,
        inboundRouting: industryPackage.inboundRouting,
        segmentTemplates: industryPackage.segmentTemplates,
        importProfiles: industryPackage.importProfiles,
        idempotent: true,
      });
    }

    const capResult = installPackageCapabilities({
      capabilities: industryPackage.capabilities,
      capabilityRuntime,
      nowISO: timestampISO,
    });

    const catResult = installPackageKnowledgeCategories({
      knowledgeCategories: industryPackage.knowledgeCategories,
      companyRuntime,
      nowISO: timestampISO,
    });

    const autoResult = installPackageAutomations({
      automationConfigurations: industryPackage.automationConfigurations,
      automationRuntime,
      configurationOverrides: automationConfigurationOverrides,
      nowISO: timestampISO,
    });

    const installedArtifacts = deepFreeze({
      capabilityIds: deepFreeze(capResult.capabilityIds),
      categoryIds: deepFreeze(catResult.categoryIds),
      automationIds: deepFreeze(autoResult.automationIds),
      automationConfigurationIds: deepFreeze(autoResult.automationConfigurationIds),
    });

    const installationId = `install_${industryPackage.id}_${fingerprint.slice(0, 16)}`;
    const record = this.installationRuntime.recordInstallation(
      createIndustryPackageInstallationRecord({
        id: installationId,
        workspaceId,
        packageId: industryPackage.id,
        packageVersion: industryPackage.version,
        configurationFingerprint: fingerprint,
        installedAt: timestampISO,
        status: INSTALLATION_STATUSES.INSTALLED,
        installedArtifacts,
        packageSnapshot: industryPackage,
        configuration: configuration ?? {},
      }),
    );

    return createIndustryPackageInstallationResult({
      installationId: record.id,
      workspaceId,
      packageId: industryPackage.id,
      packageVersion: industryPackage.version,
      configurationFingerprint: fingerprint,
      status: INSTALLATION_STATUSES.INSTALLED,
      installedArtifacts,
      terminology: industryPackage.terminology,
      requestTypes: industryPackage.requestTypes,
      workTypes: industryPackage.workTypes,
      interactionOutcomes: industryPackage.interactionOutcomes,
      employeeDefinitions: industryPackage.employeeDefinitions,
      communicationIntents: industryPackage.communicationIntents,
      knowledgeRequirements: industryPackage.knowledgeRequirements,
      onboardingSchema: industryPackage.onboardingSchema,
      connectedSystemRequirements: industryPackage.connectedSystemRequirements,
      connectionGuidance: industryPackage.connectionGuidance,
      approvalPolicies: industryPackage.approvalPolicies,
      subjectTypes: industryPackage.subjectTypes,
      qualificationFieldSchemas: industryPackage.qualificationFieldSchemas,
        relationshipTypes: industryPackage.relationshipTypes,
        lifecycleTransitions: industryPackage.lifecycleTransitions,
        relationshipFollowUpRules: industryPackage.relationshipFollowUpRules,
        relationshipFollowUpOutcomes: industryPackage.relationshipFollowUpOutcomes,
      inboundRouting: industryPackage.inboundRouting,
      segmentTemplates: industryPackage.segmentTemplates,
      importProfiles: industryPackage.importProfiles,
      executiveExperience: industryPackage.executiveExperience,
      idempotent: false,
    });
  }
}

export function installIndustryPackage(args = {}) {
  const installer = new IndustryPackageInstaller({ installationRuntime: args.installationRuntime });
  return installer.install(args);
}
