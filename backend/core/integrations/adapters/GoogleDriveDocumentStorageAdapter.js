/**
 * Stub document-storage adapter — import into Knowledge, never browse as SoT.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { proposeDriveImportCandidates } from "../document-storage/DriveToKnowledgeImport.js";

export class GoogleDriveDocumentStorageAdapter {
  constructor({ nowISO = () => new Date().toISOString() } = {}) {
    this.nowISO = typeof nowISO === "function" ? nowISO : () => String(nowISO);
    this.providerType = "google_drive";
    this.displayName = "Google Drive";
    this.connectionType = "document_storage";
  }

  getSetupGuidance() {
    return deepFreeze({
      summary: "Import Drive files into Knowledge. Drive stays the archive; Knowledge is citeable SoT.",
      steps: [
        "Connect Google Drive (or paste file exports).",
        "Choose files to import.",
        "Tag categories (Curriculum, Policies, SOPs).",
        "Confirm — VIBETech stores copies in Knowledge.",
      ],
      reconnectInstructions: "Reconnect Google Drive OAuth if health degrades.",
      verificationMethod: "List import candidates successfully.",
      commonProblems: ["Live browse-only access is not supported — import is required."],
      permissionsRequested: ["drive.readonly"],
      estimatedTime: "10 minutes",
    });
  }

  getCapabilities() {
    return [INTEGRATION_CAPABILITIES.INGEST_DOCUMENT, INTEGRATION_CAPABILITIES.READ_EXTERNAL_RECORD];
  }

  /**
   * List remote files as Knowledge import proposals (owner must confirm).
   */
  proposeKnowledgeImports({ files = [], defaultCategoryIds = ["SOP"] } = {}) {
    return proposeDriveImportCandidates({ files, defaultCategoryIds });
  }
}
