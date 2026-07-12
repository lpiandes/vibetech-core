import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { platformStore } from "@/lib/server/compose";
import { PLATFORM_ROLES } from "../../../backend/core/platform/permissions/rolePermissions.js";
import { LAST_BUSINESS_COOKIE } from "@/lib/platform/businessCookies";

/**
 * Member business chooser — no cross-tenant leakage.
 */
export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().toLowerCase();
  const isAdmin = session.user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN;
  const memberships = await platformStore.listBusinessesForUser(session.user.id);
  const cookieStore = await cookies();
  const recentId = cookieStore.get(LAST_BUSINESS_COOKIE)?.value ?? null;

  let rows: Array<{ id: string; name: string }> = memberships.map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? "Business"),
  }));

  if (q) {
    rows = rows.filter((row: { id: string; name: string }) => row.name.toLowerCase().includes(q));
  }

  if (rows.length === 1 && !q) {
    redirect(`/b/${rows[0].id}/home`);
  }

  const recent = recentId ? rows.find((row) => row.id === recentId) : null;
  const others = rows.filter((row) => row.id !== recent?.id);

  return (
    <main style={{ minHeight: "100vh", background: "#EEF1F5", padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ margin: 0, color: "#0F766E", fontWeight: 700 }}>VIBETech</p>
        <h1 style={{ margin: "8px 0 8px", fontSize: "2rem" }}>Choose a business</h1>
        <p style={{ margin: "0 0 24px", color: "#64748B" }}>
          Open the business you want to supervise. Your access stays inside that business only.
        </p>

        <form method="get" style={{ marginBottom: 20 }}>
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search businesses…"
            aria-label="Search businesses"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,.12)",
              fontSize: 15,
            }}
          />
        </form>

        {recent ? (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748B" }}>
              Recent
            </h2>
            <BusinessCard id={recent.id} name={recent.name} />
          </section>
        ) : null}

        <section style={{ display: "grid", gap: 10 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748B" }}>
            Your businesses
          </h2>
          {others.length === 0 && !recent ? (
            <div style={emptyCard}>
              No businesses match. Ask an owner for an invitation, or open Architect if you are designing a new one.
            </div>
          ) : null}
          {others.map((row) => (
            <BusinessCard key={row.id} id={row.id} name={row.name} />
          ))}
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
          <Link href="/architect" style={linkButton}>Open Architect</Link>
          {isAdmin ? <Link href="/admin" style={linkButtonSecondary}>Admin platform</Link> : null}
          {isAdmin ? <Link href="/platform" style={linkButtonSecondary}>Platform directory</Link> : null}
        </div>
      </div>
    </main>
  );
}

function BusinessCard({ id, name }: { id: string; name: string }) {
  return (
    <Link
      href={`/b/${id}/home`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "#0F172A",
        background: "#fff",
        border: "1px solid rgba(15,23,42,.08)",
        borderRadius: 14,
        padding: "16px 18px",
        fontWeight: 650,
      }}
    >
      {name}
      <div style={{ marginTop: 4, fontSize: 13, color: "#64748B", fontWeight: 500 }}>Open home</div>
    </Link>
  );
}

const emptyCard = {
  background: "#fff",
  border: "1px solid rgba(15,23,42,.08)",
  borderRadius: 14,
  padding: 18,
  color: "#64748B",
} as const;

const linkButton = {
  background: "#0F766E",
  color: "#fff",
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 650,
} as const;

const linkButtonSecondary = {
  background: "transparent",
  color: "#0F172A",
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,.12)",
  fontWeight: 650,
} as const;
