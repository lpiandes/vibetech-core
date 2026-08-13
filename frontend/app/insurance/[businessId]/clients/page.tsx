"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday?: string | null;
  policy?: {
    carrier?: string;
    policyNumber?: string;
    premium?: string;
    dueDay?: number;
    status?: string;
  };
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  birthday: "",
  address: "",
  carrier: "",
  policyNumber: "",
  premium: "",
  dueDay: "1",
  docsArriveDays: "10",
  effectiveDate: "",
};

export default function InsuranceClientsPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = String(params.businessId ?? "");
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedFromQuery, setOpenedFromQuery] = useState(false);

  async function load() {
    const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/clients`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not load clients.");
    setClients(data.clients ?? []);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [businessId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const wantsNew = new URLSearchParams(window.location.search).get("new") === "1";
    if (wantsNew) {
      setOpen(true);
      setOpenedFromQuery(true);
    }
  }, []);

  function closeForm() {
    setOpen(false);
    if (openedFromQuery) {
      setOpenedFromQuery(false);
      router.replace(`/insurance/${businessId}/clients`);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.phone, c.email, c.policy?.carrier, c.policy?.policyNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [clients, query]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          birthday: form.birthday || null,
          address: form.address || null,
          policy: {
            carrier: form.carrier,
            policyNumber: form.policyNumber,
            premium: form.premium,
            dueDay: Number(form.dueDay) || 1,
            docsArriveDays: Number(form.docsArriveDays) || 10,
            effectiveDate: form.effectiveDate || null,
            status: "active",
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save client.");
      setForm(emptyForm);
      closeForm();
      await load();
      if (data.client?.id) router.push(`/insurance/${businessId}/clients/${data.client.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <input
          className="fe-input"
          style={{ maxWidth: 320 }}
          placeholder="Search clients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="fe-btn"
          onClick={() => (open ? closeForm() : setOpen(true))}
        >
          {open ? "Close form" : "Add client"}
        </button>
      </div>

      {error ? <div className="fe-card"><p>{error}</p></div> : null}

      {open ? (
        <form className="fe-card" onSubmit={onSubmit}>
          <h2 style={{ marginTop: 0 }}>New client + policy</h2>
          <div className="fe-grid-2">
            <div className="fe-field">
              <label className="fe-label">Full name</label>
              <input className="fe-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="fe-field">
              <label className="fe-label">Phone</label>
              <input className="fe-input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="fe-field">
              <label className="fe-label">Email</label>
              <input className="fe-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="fe-field">
              <label className="fe-label">Birthday</label>
              <input className="fe-input" type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
            </div>
            <div className="fe-field">
              <label className="fe-label">Carrier</label>
              <input className="fe-input" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} />
            </div>
            <div className="fe-field">
              <label className="fe-label">Policy number</label>
              <input className="fe-input" value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
            </div>
            <div className="fe-field">
              <label className="fe-label">Premium</label>
              <input className="fe-input" placeholder="e.g. $48/mo" value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} />
            </div>
            <div className="fe-field">
              <label className="fe-label">Payment due day each month (1–28)</label>
              <input className="fe-input" type="number" min={1} max={28} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} />
            </div>
            <div className="fe-field">
              <label className="fe-label">Policy papers arrive in how many days?</label>
              <input className="fe-input" type="number" min={1} max={60} value={form.docsArriveDays} onChange={(e) => setForm({ ...form, docsArriveDays: e.target.value })} />
              <p className="fe-muted" style={{ margin: "0.35rem 0 0" }}>Used in the automatic “papers in the mail” text.</p>
            </div>
            <div className="fe-field">
              <label className="fe-label">Effective / issue date</label>
              <input className="fe-input" type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
            </div>
          </div>
          <div className="fe-field">
            <label className="fe-label">Address (optional)</label>
            <input className="fe-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <p className="fe-muted">Saving sends welcome + “docs in the mail” texts automatically when SMS is ready.</p>
          <button type="submit" className="fe-btn" disabled={saving}>{saving ? "Saving…" : "Save client"}</button>
        </form>
      ) : null}

      <div className="fe-card">
        {!filtered.length ? (
          <p className="fe-muted" style={{ margin: 0 }}>No clients yet. Add your first policyholder above.</p>
        ) : (
          <table className="fe-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Carrier</th>
                <th>Due day</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/insurance/${businessId}/clients/${c.id}`}>{c.name}</Link>
                    <div className="fe-muted">{c.phone || c.email}</div>
                  </td>
                  <td>{c.policy?.carrier || "—"}</td>
                  <td>{c.policy?.dueDay ?? "—"}</td>
                  <td><span className={`fe-badge ${c.policy?.status || "active"}`}>{c.policy?.status || "active"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
