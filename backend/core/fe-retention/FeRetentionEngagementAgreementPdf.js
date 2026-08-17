/**
 * Printable signed VibeKeep agreement (PDF). Regenerated from stored A2P + signature.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { buildFeRetentionEngagementAgreement } from "./FeRetentionEngagementAgreement.js";
import { VIBEKEEP_AGREEMENT_VERSION } from "./FeRetentionOnboardingCatalog.js";

const CYAN = "#22d3ee";
const PURPLE = "#a855f7";
const NAVY = "#0f172a";
const MUTED = "#475569";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function slugPart(value) {
  return safeString(value).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agency";
}

export function feRetentionAgreementPdfFilename({ legalName = "", signedAt = "" } = {}) {
  const day = String(signedAt || "").slice(0, 10) || "signed";
  return `VibeKeep-Engagement-Agreement-${slugPart(legalName)}-${day}.pdf`;
}

function resolveWordmarkPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "../../../frontend/public/brand/vibetech-wordmark.png"),
    path.join(process.cwd(), "public/brand/vibetech-wordmark.png"),
    path.join(process.cwd(), "frontend/public/brand/vibetech-wordmark.png"),
  ];
  return candidates.find((file) => {
    try {
      return fs.existsSync(file);
    } catch {
      return false;
    }
  }) ?? null;
}

function bufferFromPdf(doc) {
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  return done;
}

export async function renderFeRetentionEngagementAgreementPdf({
  profile = {},
  signedName = "",
  signedAt = null,
} = {}) {
  const built = buildFeRetentionEngagementAgreement({ profile, signedName, signedAt });
  const doc = new PDFDocument({ size: "LETTER", margin: 54, info: {
    Title: "VibeKeep Engagement Agreement",
    Author: "VibeTech Development",
    Subject: `${built.legalName} — ${VIBEKEEP_AGREEMENT_VERSION}`,
  } });
  const pending = bufferFromPdf(doc);

  doc.rect(0, 0, doc.page.width, 28).fill(NAVY);
  doc.rect(0, 28, doc.page.width, 6).fill(CYAN);
  doc.rect(0, 34, doc.page.width, 3).fill(PURPLE);

  doc.moveDown(2);
  const wordmark = resolveWordmarkPath();
  if (wordmark) {
    try {
      doc.image(wordmark, 54, 52, { height: 28 });
      doc.moveDown(3.2);
    } catch {
      doc.fillColor(NAVY).fontSize(16).font("Helvetica-Bold").text("VibeTech Development");
    }
  } else {
    doc.fillColor(NAVY).fontSize(16).font("Helvetica-Bold").text("VibeTech Development");
  }

  doc.fillColor(CYAN).fontSize(10).font("Helvetica-Bold").text("VIBEKEEP");
  doc.moveDown(0.25);
  doc.fillColor(NAVY).fontSize(18).font("Helvetica-Bold").text("Engagement Agreement");
  doc.fillColor(MUTED).fontSize(10).font("Helvetica").text(`Version ${VIBEKEEP_AGREEMENT_VERSION}`);
  doc.moveDown(0.8);

  doc.fillColor(CYAN).fontSize(12).font("Helvetica-Bold").text(built.legalName);
  const address = [
    safeString(profile.street),
    [safeString(profile.city), safeString(profile.region), safeString(profile.postalCode)].filter(Boolean).join(", "),
  ].filter(Boolean).join("\n");
  doc.fillColor(NAVY).fontSize(11).font("Helvetica").text(address || "(address on file)");
  doc.moveDown(0.9);

  const clauses = built.text.split("\n\n").filter((block) => /^\d+\./.test(block.trim()));
  for (const block of clauses) {
    doc.fillColor(NAVY).fontSize(10).font("Helvetica").text(block.trim(), { align: "left" });
    doc.moveDown(0.45);
  }

  doc.moveDown(0.4);
  doc.fillColor(MUTED).fontSize(9).text(`Questions: see the signed copy footer.`);
  doc.moveDown(0.6);

  const boxTop = doc.y;
  doc.save();
  doc.roundedRect(54, boxTop, doc.page.width - 108, 72, 8).lineWidth(1.5).strokeColor(PURPLE).stroke();
  doc.restore();
  doc.fillColor(PURPLE).fontSize(9).font("Helvetica-Bold").text("ELECTRONIC SIGNATURE", 66, boxTop + 10);
  doc.fillColor(NAVY).fontSize(12).font("Helvetica-Bold").text(`Signed: ${built.signer}`, 66, boxTop + 28);
  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`Date (UTC): ${built.signedAt}`, 66, boxTop + 46);

  doc.end();
  const buffer = await pending;
  return {
    ok: true,
    buffer,
    filename: feRetentionAgreementPdfFilename({
      legalName: built.legalName,
      signedAt: built.signedAt,
    }),
    legalName: built.legalName,
    signer: built.signer,
  };
}
