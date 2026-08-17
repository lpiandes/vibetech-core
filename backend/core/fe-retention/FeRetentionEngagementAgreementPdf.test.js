import test from "node:test";
import assert from "node:assert/strict";
import {
  renderFeRetentionEngagementAgreementPdf,
  feRetentionAgreementPdfFilename,
} from "./FeRetentionEngagementAgreementPdf.js";
import { feRetentionAgreementPdfHref } from "./FeRetentionOnboardingCatalog.js";

const profile = {
  legalBusinessName: "Second Agency LLC",
  street: "1 Main St",
  city: "Nashua",
  region: "NH",
  postalCode: "03060",
};

test("signed agreement PDF is named from the legal business and includes the signature", async () => {
  const pdf = await renderFeRetentionEngagementAgreementPdf({
    profile,
    signedName: "Pat Owner",
    signedAt: "2026-08-17T15:00:00.000Z",
  });
  assert.equal(pdf.ok, true);
  assert.equal(pdf.signer, "Pat Owner");
  assert.equal(pdf.filename, "VibeKeep-Engagement-Agreement-Second-Agency-LLC-2026-08-17.pdf");
  assert.equal(pdf.buffer.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.buffer.length > 400);
  assert.equal(
    feRetentionAgreementPdfHref("biz_two"),
    "/api/insurance/biz_two/agreement-pdf",
  );
  assert.match(feRetentionAgreementPdfFilename({ legalName: "A & B LLC", signedAt: "2026-01-01" }), /A-B-LLC/);
});
