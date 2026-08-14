"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { brand } from "@/design/tokens/brand";
import {
  VIBEKEEP_TAGLINE,
  VIBEKEEP_MONTHLY_PRICE_LABEL,
} from "@/lib/insurance/productBrand";

const STORY = [
  "Reminders before premium day — so the policy stays active.",
  "Birthday and holiday check-ins, sent in your name.",
  "Lapse notices surfaced the morning they matter.",
];

export function InsurancePublicShell({
  children,
  title,
  lede,
  showStory = false,
}: {
  children: ReactNode;
  title: string;
  lede?: string;
  showStory?: boolean;
}) {
  return (
    <div className="vk-gate">
      <style dangerouslySetInnerHTML={{ __html: `
        .vk-gate {
          min-height: 100vh;
          margin: 0;
          color: ${brand.text};
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          background:
            radial-gradient(ellipse 55% 50% at 0% 0%, rgba(34, 211, 238, 0.16) 0%, transparent 58%),
            radial-gradient(ellipse 50% 45% at 100% 8%, rgba(168, 85, 247, 0.16) 0%, transparent 52%),
            radial-gradient(ellipse 40% 30% at 50% 100%, rgba(217, 70, 239, 0.08) 0%, transparent 50%),
            ${brand.bgDeep};
        }
        .vk-gate * { box-sizing: border-box; }
        .vk-frame {
          max-width: ${showStory ? "1040px" : "460px"};
          margin: 0 auto;
          padding: 2.5rem 1.25rem 3.5rem;
        }
        .vk-lockup {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          justify-content: ${showStory ? "flex-start" : "center"};
          margin-bottom: 1.85rem;
        }
        .vk-wordmark {
          display: flex;
          flex-direction: column;
          line-height: 1;
        }
        .vk-wordmark strong {
          font-size: 1.15rem;
          letter-spacing: 0.08em;
          font-weight: 800;
        }
        .vk-wordmark strong span { color: ${brand.cyan}; }
        .vk-wordmark small {
          margin-top: 0.28rem;
          font-size: 0.62rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: ${brand.textMuted};
          font-weight: 650;
        }
        .vk-grid {
          display: grid;
          grid-template-columns: ${showStory ? "1fr minmax(320px, 420px)" : "1fr"};
          gap: 3rem;
          align-items: center;
        }
        @media (max-width: 860px) {
          .vk-grid { grid-template-columns: 1fr; gap: 1.75rem; }
          .vk-lockup { justify-content: center; }
          .vk-story { text-align: center; }
          .vk-story ul { display: inline-block; text-align: left; }
        }
        .vk-product {
          font-size: clamp(2.4rem, 5vw, 3.4rem);
          font-weight: 750;
          letter-spacing: -0.045em;
          line-height: 1.05;
          margin: 0 0 0.65rem;
        }
        .vk-product em {
          font-style: normal;
          background: ${brand.primaryGradient};
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .vk-tagline {
          color: ${brand.textMuted};
          font-size: 1.08rem;
          line-height: 1.55;
          margin: 0 0 1.4rem;
          max-width: 28rem;
        }
        .vk-story ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .vk-story li {
          position: relative;
          padding: 0.45rem 0 0.45rem 1.35rem;
          color: ${brand.text};
          font-size: 0.95rem;
          line-height: 1.45;
        }
        .vk-story li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.85rem;
          width: 8px;
          height: 8px;
          border-radius: 99px;
          background: ${brand.primaryGradient};
        }
        .vk-price {
          display: inline-flex;
          margin-top: 1.35rem;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          border: 1px solid ${brand.borderGlow};
          background: rgba(34, 211, 238, 0.08);
          color: ${brand.cyanSoft};
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .vk-card {
          padding: 1.5rem 1.4rem 1.35rem;
          border-radius: 18px;
          border: 1px solid ${brand.border};
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, ${brand.bg} 100%);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 24px 64px rgba(0, 0, 0, 0.35),
            0 0 80px rgba(34, 211, 238, 0.08);
        }
        .vk-card h1, .vk-card h2 {
          font-size: 1.45rem;
          letter-spacing: -0.03em;
          margin: 0 0 0.4rem;
          font-weight: 700;
        }
        .vk-lede {
          color: ${brand.textMuted};
          line-height: 1.5;
          margin: 0 0 1.25rem;
          font-size: 0.95rem;
        }
        .vk-gate input:focus {
          outline: none;
          border-color: ${brand.cyan} !important;
          box-shadow: 0 0 0 3px ${brand.borderGlow};
        }
        .vk-gate a { color: ${brand.cyan}; font-weight: 700; text-decoration: none; }
        .vk-gate a:hover { color: ${brand.cyanSoft}; }
      ` }} />
      <div className="vk-frame">
        <div className="vk-lockup">
          <Image
            src="/brand/vibetech-logo.png"
            alt="VibeTech"
            width={56}
            height={56}
            priority
            style={{ width: 56, height: 56, objectFit: "contain" }}
          />
          <div className="vk-wordmark">
            <strong>VIBE<span>TECH</span></strong>
            <small>Development</small>
          </div>
        </div>
        <div className="vk-grid">
          {showStory ? (
            <div className="vk-story">
              <p className="vk-product">
                Vibe<em>Keep</em>
              </p>
              <p className="vk-tagline">{VIBEKEEP_TAGLINE} Automatic reminders, birthdays, and lapse recovery for your book — without the busywork.</p>
              <ul>
                {STORY.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="vk-price">{VIBEKEEP_MONTHLY_PRICE_LABEL} · cancel anytime in billing</div>
            </div>
          ) : null}
          <div className="vk-card">
            <h1>{title}</h1>
            {lede ? <p className="vk-lede">{lede}</p> : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
