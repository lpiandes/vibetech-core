"use client";

import { useState } from "react";
import { Building2, ChevronRight, Plus } from "lucide-react";

type BusinessRecord = {
  id: string;
  workspaceId: string;
  name: string;
  kind: "NORMAL" | "DEMO";
};

const IS_DEV = process.env.NODE_ENV === "development";

async function fetchBusinesses(): Promise<BusinessRecord[]> {
  const res = await fetch("/api/businesses", { cache: "no-store" });
  const data = await res.json();
  return Array.isArray(data?.businesses) ? data.businesses : [];
}

function setWorkspaceCookie(workspaceId: string) {
  document.cookie = `vibetech_workspace_id=${encodeURIComponent(workspaceId)}; path=/; SameSite=Lax`;
}

export default function BusinessEntryScreen({ initialBusinesses }: { initialBusinesses: BusinessRecord[] }) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setBusinesses(await fetchBusinesses());
  }

  async function createBusiness() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Could not create business");
      await refresh();
      setName("");
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create business");
    } finally {
      setBusy(false);
    }
  }

  async function createHorizonDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/horizon", { method: "POST" });
      if (!res.ok) throw new Error("Could not create demo");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create demo");
    } finally {
      setBusy(false);
    }
  }

  function openBusiness(workspaceId: string) {
    setWorkspaceCookie(workspaceId);
    window.location.assign("/home");
  }

  const normalBusinesses = businesses.filter((b) => b.kind !== "DEMO");
  const demoBusinesses = businesses.filter((b) => b.kind === "DEMO");

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="mx-auto flex max-w-md flex-col gap-8 px-6 py-14">
        <header>
          <p className="text-sm font-semibold text-[#3b82f6]">VIBETech</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Businesses</h1>
        </header>

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          {normalBusinesses.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-slate-600">No businesses yet</p>
            </div>
          ) : (
            <ul>
              {normalBusinesses.map((business) => (
                <li key={business.id}>
                  <button
                    type="button"
                    onClick={() => openBusiness(business.workspaceId)}
                    className="group flex w-full items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eff6ff] text-[#3b82f6] transition-colors group-hover:bg-[#dbeafe]">
                        <Building2 size={20} />
                      </span>
                      <span className="truncate font-semibold text-slate-900">{business.name}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#3b82f6]">
                      Open
                      <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {creating ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createBusiness()}
              placeholder="Business name"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20"
            />
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={createBusiness}
              className="rounded-lg bg-[#3b82f6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563eb] disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setName("");
              }}
              className="rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#3b82f6] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#2563eb]"
          >
            <Plus size={16} />
            Create business
          </button>
        )}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {IS_DEV ? (
          <div className="mt-2 border-t border-slate-200/80 pt-4">
            <button
              type="button"
              onClick={() => setShowDevTools((v) => !v)}
              className="text-[10px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-500"
            >
              Developer tools {showDevTools ? "▾" : "▸"}
            </button>
            {showDevTools ? (
              <div className="mt-2 space-y-2 rounded-md border border-amber-200/50 bg-amber-50/40 p-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={createHorizonDemo}
                    className="rounded border border-amber-200 bg-white px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                  >
                    Create Horizon demo
                  </button>
                  {demoBusinesses[0] ? (
                    <button
                      type="button"
                      onClick={() => openBusiness(demoBusinesses[0].workspaceId)}
                      className="px-2 py-1 text-[11px] font-medium text-amber-800 underline-offset-2 hover:underline"
                    >
                      Open Horizon demo
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
