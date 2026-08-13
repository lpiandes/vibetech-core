import Link from "next/link";
import { redirect } from "next/navigation";
import { getFeRetentionAccess } from "@/lib/platform/feRetentionAccess";
import { insuranceDashboardPath } from "@/lib/platform/hosts";
import { brand } from "@/design/tokens/brand";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  margin: 0,
  background: `radial-gradient(ellipse 70% 45% at 12% -8%, rgba(34,211,238,0.12) 0%, transparent 55%), ${brand.bgDeep}`,
  color: brand.text,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
};

const wrapStyle: React.CSSProperties = {
  maxWidth: 480,
  margin: "0 auto",
  padding: "4rem 1.25rem",
};

export default async function InsuranceIndexPage() {
  const access = await getFeRetentionAccess();

  if (!access.signedIn) {
    return (
      <main style={pageStyle}>
        <div style={wrapStyle}>
          <p style={{ color: brand.cyan, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 12 }}>
            VibeTech Insurance
          </p>
          <h1 style={{ fontSize: "2rem", margin: "0.4rem 0 0.75rem", letterSpacing: "-0.02em" }}>Final Expense Retention</h1>
          <p style={{ color: brand.textMuted, lineHeight: 1.5 }}>
            Sign in with the invite email your agency admin sent you to open your private client dashboard.
          </p>
          <p>
            <Link href={`/login?callbackUrl=${encodeURIComponent("/insurance")}`} style={{ color: brand.cyan, fontWeight: 700 }}>
              Sign in →
            </Link>
          </p>
        </div>
      </main>
    );
  }

  if (!access.entitled || !access.businesses.length) {
    return (
      <main style={pageStyle}>
        <div style={wrapStyle}>
          <h1 style={{ letterSpacing: "-0.02em" }}>No FE Retention workspace yet</h1>
          <p style={{ color: brand.textMuted }}>
            Ask your VibeTech admin to invite you with the Final Expense Retention CRM package.
          </p>
        </div>
      </main>
    );
  }

  if (access.businesses.length === 1) {
    redirect(insuranceDashboardPath(access.businesses[0].id));
  }

  return (
    <main style={pageStyle}>
      <div style={{ ...wrapStyle, maxWidth: 560 }}>
        <h1 style={{ letterSpacing: "-0.02em" }}>Choose your book</h1>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {access.businesses.map((b) => (
            <li key={b.id} style={{ marginBottom: 12 }}>
              <Link href={insuranceDashboardPath(b.id)} style={{ color: brand.cyan, fontWeight: 700, fontSize: "1.1rem" }}>
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
