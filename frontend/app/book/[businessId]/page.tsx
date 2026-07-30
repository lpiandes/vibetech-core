"use client";

import { useEffect, useState } from "react";

type Slot = { id: string; startISO: string; endISO: string; label: string; memberId: string; memberName: string };

export default function BookingPage({ params }: { params: Promise<{ businessId: string }> }) {
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("Our team");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [done, setDone] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ businessId: id }) => {
      setBusinessId(id);
      fetch(`/api/book/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setBusinessName(data.businessName ?? "Our team");
          setSlots(Array.isArray(data.slots) ? data.slots : []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [params]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const res = await fetch(`/api/book/${businessId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, slotStart: selected }) });
    const data = await res.json();
    if (!data.ok) setError(data.error ?? "Could not book your appointment.");
    else {
      setConfirmed(data.confirmed === true);
      setDone(true);
    }
  };

  if (done) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-20 text-white">
        <section className="mx-auto max-w-lg rounded-2xl border border-emerald-500/40 bg-zinc-900 p-8">
          <h1 className="text-3xl font-semibold">{confirmed ? "You\u2019re booked" : "Request received"}</h1>
          <p className="mt-3 text-zinc-300">
            {confirmed
              ? <>Thanks — your appointment with {businessName} is confirmed. We&rsquo;ll see you then.</>
              : <>Thanks — we have your request for {businessName}. Our team will confirm your appointment shortly.</>}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <form onSubmit={submit} className="mx-auto max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-widest text-emerald-400">Book an appointment</p>
        <h1 className="mt-2 text-3xl font-semibold">Book with {businessName}</h1>
        <p className="mt-3 text-sm text-zinc-400">Choose a time — it&rsquo;s confirmed the moment you submit.</p>
        <div className="mt-6 grid gap-3">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading available times…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-zinc-500">No open times right now — please check back soon.</p>
          ) : (
            slots.map((slot) => (
              <button
                type="button"
                key={slot.id}
                onClick={() => setSelected(slot.startISO)}
                className={`rounded-lg border p-3 text-left ${selected === slot.startISO ? "border-emerald-400 bg-emerald-400/10" : "border-zinc-700"}`}
              >
                <div>{slot.label}</div>
                {slot.memberName ? <div className="mt-0.5 text-xs text-zinc-500">With {slot.memberName}</div> : null}
              </button>
            ))
          )}
        </div>
        <div className="mt-6 grid gap-3">
          {(["name", "email", "phone"] as const).map((key) => (
            <input
              key={key}
              required={key !== "email"}
              placeholder={key[0].toUpperCase() + key.slice(1)}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="rounded-lg border border-zinc-700 bg-zinc-950 p-3"
            />
          ))}
          <textarea
            placeholder="Anything we should know? (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-lg border border-zinc-700 bg-zinc-950 p-3"
          />
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button disabled={!selected} className="mt-6 w-full rounded-lg bg-emerald-400 p-3 font-medium text-zinc-950 disabled:opacity-50">
          Book appointment
        </button>
      </form>
    </main>
  );
}
