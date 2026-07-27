import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Social Checker · VibeTech",
  description:
    "Enter a name to discover public social profiles across LinkedIn, Instagram, YouTube, X, Facebook, and TikTok — then download a PDF summary.",
};

export default function SocialCheckerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
