import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VibeKeep · VibeTech",
  description: "Keep every client in force — automatic reminders, birthdays, holidays, and lapse recovery.",
};

export default function InsuranceRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
