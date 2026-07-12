"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";

import SimpleModal from "@/components/product/SimpleModal";
import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors, spacing, typography } from "@/design/tokens";

const MAX_MB = 10;

export default function KnowledgeAddDialog({
  businessId,
  onClose,
  onUploaded,
}: {
  businessId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function upload() {
    if (!file || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (title.trim()) formData.append("title", title.trim());

    try {
      const res = await fetch(`/api/businesses/${businessId}/knowledge`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? "Could not upload document."));
        setBusy(false);
        submittingRef.current = false;
        return;
      }
      onUploaded();
      router.refresh();
      onClose();
    } catch {
      setError("Could not upload document. Try again.");
      setBusy(false);
      submittingRef.current = false;
    }
  }

  return (
    <SimpleModal
      title="Upload document"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => void upload()} disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload"}
          </PrimaryButton>
        </>
      }
    >
      <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: `0 0 ${spacing.md}`, lineHeight: 1.45 }}>
        Upload policies, procedures, guides, or reference documents. VIBETech uses these to follow how your business works.
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: 10,
          border: `1px dashed ${cockpitColors.panelBorder}`,
          backgroundColor: cockpitColors.panelElevated,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, color: cockpitColors.textMuted }}>
          <FileUp size={18} />
          <span style={{ fontSize: typography.caption.fontSize }}>PDF, DOCX, TXT, or MD · up to {MAX_MB}MB</span>
        </div>
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
            Selected: <strong>{file.name}</strong> ({formatBytes(file.size)})
          </div>
        ) : null}
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: spacing.xs, marginTop: spacing.md }}>
        <span style={{ fontSize: typography.caption.fontSize, fontWeight: 600 }}>Title (optional)</span>
        <input
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Defaults to file name"
          style={{ padding: `${spacing.sm} ${spacing.md}`, borderRadius: 8, border: `1px solid ${cockpitColors.panelBorder}` }}
        />
      </label>
      {error ? <p style={{ color: "#dc2626", margin: `${spacing.sm} 0 0`, fontSize: typography.caption.fontSize }}>{error}</p> : null}
    </SimpleModal>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
