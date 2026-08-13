import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FE Retention CRM · VibeTech Insurance",
  description: "Final Expense client retention — reminders, birthdays, holidays, and lapse recovery on autopilot.",
};

export default function InsuranceRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
