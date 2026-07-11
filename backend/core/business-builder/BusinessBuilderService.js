import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  createBusinessBuilderSession,
  createDiscoveryAnswer,
  withBuilderSessionUpdate,
} from "./BusinessBuilderSession.js";
import {
  nextDiscoveryQuestions,
  discoveryProgress,
  listDiscoveryQuestions,
} from "./BusinessDiscoveryQuestionEngine.js";
import {
  classifyDiscoveryUpload,
  createDiscoveryEvidence,
} from "./BusinessDiscoveryEvidence.js";
import { BusinessResearchProvider } from "./BusinessResearchProvider.js";
import { BusinessOSProposalService } from "./BusinessOSProposalService.js";
import { BusinessCapabilityGapAnalyzer } from "./BusinessCapabilityGapAnalyzer.js";
import { buildBusinessBuilderReviewProjection } from "./BusinessBuilderReviewProjection.js";
import { BusinessOSCompiler } from "../business-os/BusinessOSCompiler.js";
import { BusinessOSInstaller, InMemoryBusinessOSInstallStore } from "../business-os/BusinessOSInstaller.js";
import { validateBusinessOSSpecification } from "../business-os/BusinessOSSpecificationValidator.js";
import { getDefaultBusinessOSCapabilityRegistry } from "../business-os/BusinessOSCapabilityRegistry.js";

/**
 * Governed Business Builder workflow orchestrator.
 */
export class BusinessBuilderService {
  constructor({
    store = new InMemoryBusinessOSInstallStore(),
    researchProvider = new BusinessResearchProvider(),
    proposalService = new BusinessOSProposalService(),
    gapAnalyzer = new BusinessCapabilityGapAnalyzer(),
    compiler = new BusinessOSCompiler(),
    installer = null,
  } = {}) {
    this.sessions = new Map();
    this.store = store;
    this.researchProvider = researchProvider;
    this.proposalService = proposalService;
    this.gapAnalyzer = gapAnalyzer;
    this.compiler = compiler;
    this.installer = installer ?? new BusinessOSInstaller({ store });
  }

  startSession({ mode = "operator", businessName = null, websiteUrl = null, businessId = null, createdByUserId = null } = {}) {
    const session = createBusinessBuilderSession({
      mode,
      businessName,
      websiteUrl,
      businessId,
      createdByUserId,
    });
    this.sessions.set(session.sessionId, session);
    return deepFreeze({
      ok: true,
      session,
      nextQuestions: nextDiscoveryQuestions({ answers: [], limit: 4 }),
      progress: discoveryProgress({ answers: [] }),
      catalogSize: listDiscoveryQuestions().length,
    });
  }

  getSession(sessionId) {
    return this.sessions.get(String(sessionId)) ?? null;
  }

  getDiscoveryState(sessionId) {
    const session = this.requireSession(sessionId);
    return deepFreeze({
      ok: true,
      session,
      nextQuestions: nextDiscoveryQuestions({ answers: session.answers, limit: 4 }),
      progress: discoveryProgress({ answers: session.answers }),
    });
  }

  answerQuestion({ sessionId, questionId, answer, confidence = 0.8, evidenceSource = "conversation", whyAsked = null }) {
    const session = this.requireSession(sessionId);
    const record = createDiscoveryAnswer({
      questionId,
      answer,
      confidence,
      evidenceSource,
      whyAsked,
      affectedSections: [],
    });
    const answers = [...session.answers.filter((entry) => entry.questionId !== questionId), record];
    const updated = withBuilderSessionUpdate(session, { answers, status: "discovery" });
    this.sessions.set(sessionId, updated);
    return deepFreeze({
      ok: true,
      session: updated,
      nextQuestions: nextDiscoveryQuestions({ answers, limit: 3 }),
      progress: discoveryProgress({ answers }),
    });
  }

  async attachWebsiteResearch({ sessionId, websiteUrl = null, nowISO = new Date().toISOString() }) {
    const session = this.requireSession(sessionId);
    const url = websiteUrl ?? session.websiteUrl;
    const research = await this.researchProvider.researchBusiness({
      websiteUrl: url,
      businessName: session.businessName,
      nowISO,
    });
    if (!research.ok) return deepFreeze({ ok: false, reason: research.reason, session });

    const evidence = createDiscoveryEvidence({
      evidenceId: `ev_web_${session.sessionId}`,
      kind: "website_research",
      label: "Website research",
      source: "research_provider",
      confidence: research.result.confidence,
      payload: research.result,
      retrievedAt: nowISO,
    });
    const updated = withBuilderSessionUpdate(session, {
      websiteUrl: url,
      evidence: [...session.evidence, evidence],
      businessName: session.businessName ?? research.result.businessName,
    });
    this.sessions.set(sessionId, updated);
    return deepFreeze({ ok: true, session: updated, research: research.result });
  }

  attachUpload({ sessionId, filename, mimeType = "", notes = "" }) {
    const session = this.requireSession(sessionId);
    const kind = classifyDiscoveryUpload({ filename, mimeType, notes });
    const evidence = createDiscoveryEvidence({
      evidenceId: `ev_upload_${filename}`.slice(0, 80),
      kind,
      label: filename,
      source: "upload",
      payload: { filename, mimeType, notes, classifiedAs: kind },
    });
    const updated = withBuilderSessionUpdate(session, {
      evidence: [...session.evidence, evidence],
    });
    this.sessions.set(sessionId, updated);
    return deepFreeze({
      ok: true,
      session: updated,
      classification: kind,
      mutatesCanonicalData: false,
    });
  }

  propose({ sessionId, nowISO = new Date().toISOString() }) {
    const session = this.requireSession(sessionId);
    const proposal = this.proposalService.proposeFromSession(session, { nowISO });
    const validation = validateBusinessOSSpecification(proposal.specification, {
      capabilityRegistry: getDefaultBusinessOSCapabilityRegistry(),
      allowUnresolved: true,
    });
    const updated = withBuilderSessionUpdate(session, {
      status: "proposed",
      specificationId: proposal.specification.specificationId,
    });
    this.sessions.set(sessionId, updated);
    const review = buildBusinessBuilderReviewProjection({
      session: updated,
      specification: proposal.specification,
      capabilityProposals: proposal.capabilityProposals,
    });
    return deepFreeze({
      ok: true,
      session: updated,
      specification: proposal.specification,
      validation,
      review,
      capabilityProposals: proposal.capabilityProposals,
    });
  }

  dryRun({ sessionId, specification, nowISO = new Date().toISOString() }) {
    const session = this.requireSession(sessionId);
    const businessId = session.businessId ?? `draft_${session.sessionId}`;
    const scopedSpec = specification.businessId
      ? specification
      : { ...specification, businessId };
    // createBusinessOSSpecification would re-hash; installer only checks businessId string match.
    const specForInstall = Object.freeze({ ...scopedSpec, businessId: String(businessId) });
    const compiled = this.compiler.compile(specification, { nowISO });
    if (!compiled.ok) return deepFreeze({ ok: false, reason: compiled.reason, compiled });

    const dryRunResult = this.installer.dryRun({
      specification: specForInstall,
      plan: compiled.plan,
      businessId,
      nowISO,
    });
    const updated = withBuilderSessionUpdate(session, { status: "dry_run", businessId });
    this.sessions.set(sessionId, updated);
    const review = buildBusinessBuilderReviewProjection({
      session: updated,
      specification,
      plan: compiled.plan,
      dryRunResult,
    });
    return deepFreeze({
      ok: dryRunResult.ok,
      session: updated,
      plan: compiled.plan,
      dryRunResult,
      review,
    });
  }

  install({ sessionId, specification, plan, dryRunResult, approved = false, nowISO = new Date().toISOString() }) {
    const session = this.requireSession(sessionId);
    if (!approved) return deepFreeze({ ok: false, reason: "approval_required" });
    const businessId = session.businessId ?? `draft_${session.sessionId}`;
    const specForInstall = Object.freeze({ ...specification, businessId: String(businessId) });
    const installed = this.installer.install({
      specification: specForInstall,
      plan,
      businessId,
      dryRunResult,
      approved: true,
      nowISO,
    });
    if (!installed.ok) return deepFreeze({ ok: false, ...installed });
    const updated = withBuilderSessionUpdate(session, { status: "installed", businessId });
    this.sessions.set(sessionId, updated);
    return deepFreeze({
      ok: true,
      session: updated,
      installation: installed.installation,
      configuration: installed.configuration,
    });
  }

  requireSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`BusinessBuilderService: unknown session ${sessionId}`);
    return session;
  }
}
