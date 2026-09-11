import React, { useEffect, useRef, useState } from "react";

/**
 * KnowFlow AI — Homepage Hero Section
 * Restored to original warm paper & editorial palette with verifiable citations.
 */

interface HeroSectionProps {
  onGetStarted?: () => void;
  onExploreDemo?: () => void;
}

const ANSWER =
  "Meals during business travel are reimbursed up to $75/day with itemized receipts[1]. Successful engineering referrals receive a $3,000 bonus paid after 90 days of employment[2].";

export const HeroSection: React.FC<HeroSectionProps> = ({
  onGetStarted,
  onExploreDemo,
}) => {
  const [typed, setTyped] = useState("");
  const [showCitations, setShowCitations] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setTyped(ANSWER);
      setShowCitations(true);
      return;
    }

    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setTyped(ANSWER.slice(0, i));
      if (i >= ANSWER.length && !doneRef.current) {
        doneRef.current = true;
        clearInterval(interval);
        setTimeout(() => setShowCitations(true), 350);
      }
    }, 18);

    return () => clearInterval(interval);
  }, []);

  // Split typed text so we can render [1] / [2] as styled citation chips
  const renderAnswer = (text: string) => {
    const parts = text.split(/(\[\d\])/g);
    return parts.map((part, idx) =>
      /^\[\d\]$/.test(part) ? (
        <sup className="kf-cite" key={idx}>
          {part}
        </sup>
      ) : (
        <span key={idx}>{part}</span>
      )
    );
  };

  return (
    <section className="kf-hero">
      <style>{`
        .kf-hero {
          --paper: rgba(236, 233, 223, 0.5);
          --ink: #1B1F27;
          --ink-soft: #5B6270;
          --accent: #2E6F5E;
          --accent-soft: rgba(46, 111, 94, 0.12);
          --brass: #A9772F;
          --line: #DDD9CC;
          --card: #FFFFFF;
          --bubble: #ECE9DF;

          background: var(--paper);
          color: var(--ink);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 88px 8vw 96px;
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          gap: 64px;
          align-items: center;
          min-height: 640px;
        }

        .kf-hero * { box-sizing: border-box; }

        .kf-left { max-width: 520px; }

        .kf-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 56px;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.01em;
        }

        .kf-brand svg { display: block; }

        .kf-headline {
          font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
          font-size: clamp(38px, 4.6vw, 58px);
          line-height: 1.08;
          font-weight: 600;
          letter-spacing: -0.01em;
          margin: 0 0 24px;
          padding-left: 18px;
          border-left: 3px solid var(--accent);
        }

        .kf-sub {
          font-size: 17px;
          line-height: 1.6;
          color: var(--ink-soft);
          margin: 0 0 36px;
          max-width: 460px;
        }

        .kf-ctas {
          display: flex;
          gap: 14px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }

        .kf-btn {
          font-size: 15px;
          font-weight: 600;
          padding: 13px 24px;
          border-radius: 3px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }

        .kf-btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .kf-btn-primary {
          background: var(--ink);
          color: var(--paper);
        }
        .kf-btn-primary:hover { background: var(--accent); }

        .kf-btn-secondary {
          background: transparent;
          color: var(--ink);
          border-color: var(--line);
        }
        .kf-btn-secondary:hover { border-color: var(--ink); }

        .kf-trust {
          font-size: 13.5px;
          color: var(--ink-soft);
          max-width: 380px;
          line-height: 1.5;
        }

        .kf-right { display: flex; justify-content: center; }

        .kf-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 10px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 24px 60px -28px rgba(27, 31, 39, 0.35);
          overflow: hidden;
        }

        .kf-card-header {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--line);
        }

        .kf-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
        }

        .kf-card-header span {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink);
        }

        .kf-thread {
          padding: 20px 20px 8px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .kf-bubble-user {
          align-self: flex-end;
          background: var(--bubble);
          border-radius: 8px 8px 2px 8px;
          padding: 10px 14px;
          font-size: 14px;
          max-width: 82%;
        }

        .kf-bubble-answer {
          font-size: 14.5px;
          line-height: 1.65;
          color: var(--ink);
          min-height: 78px;
        }

        .kf-cite {
          color: var(--brass);
          font-weight: 700;
          margin-left: 1px;
        }

        .kf-sources {
          border-top: 1px solid var(--line);
          padding: 14px 20px 18px;
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 0.4s ease, transform 0.4s ease;
        }

        .kf-sources.kf-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .kf-source-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 12.5px;
          color: var(--ink-soft);
          padding: 5px 0;
        }

        .kf-source-row b {
          color: var(--brass);
          font-weight: 700;
          margin-right: 6px;
        }

        @media (max-width: 900px) {
          .kf-hero {
            grid-template-columns: 1fr;
            padding: 56px 6vw 64px;
            gap: 48px;
          }
          .kf-left { max-width: 100%; }
          .kf-right { justify-content: flex-start; }
        }

        @media (prefers-reduced-motion: reduce) {
          .kf-sources { transition: none; }
        }
      `}</style>

      <div className="kf-left">
        <div className="kf-brand">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 4h5v5H4V4zm7 7h5v5h-5v-5z"
              stroke="#1B1F27"
              strokeWidth="1.6"
            />
          </svg>
          KnowFlow
        </div>

        <h1 className="kf-headline">Every enterprise answer, verified at the source.</h1>

        <p className="kf-sub">
          KnowFlow transforms static corporate policies, SOPs, and handbooks into an instant, conversational knowledge hub. Eliminate repetitive internal support tickets, accelerate employee onboarding, and make critical decisions with 100% confidence — every claim links directly to its source document.
        </p>

        <div className="kf-ctas">
          <button
            type="button"
            className="kf-btn kf-btn-primary"
            onClick={onGetStarted}
          >
            Request a demo
          </button>
          <button
            type="button"
            className="kf-btn kf-btn-secondary"
            onClick={onExploreDemo || onGetStarted}
          >
            Read the docs
          </button>
        </div>

        <p className="kf-trust">
          Engineered for HR, Finance, Legal, and Operations teams who require
          audit-ready accuracy with strict multi-tenant access control.
        </p>
      </div>

      <div className="kf-right">
        <div className="kf-card">
          <div className="kf-card-header">
            <span className="kf-dot" />
            <span>Acme Corp Policy Assistant</span>
          </div>

          <div className="kf-thread">
            <div className="kf-bubble-user">
              What is the meal reimbursement limit and the employee referral bonus?
            </div>
            <div className="kf-bubble-answer">{renderAnswer(typed)}</div>
          </div>

          <div className={`kf-sources ${showCitations ? "kf-visible" : ""}`}>
            <div className="kf-source-row">
              <span><b>[1]</b>Travel_&_Expense_Policy_2026.pdf</span>
              <span>p. 4</span>
            </div>
            <div className="kf-source-row">
              <span><b>[2]</b>Talent_Referral_Program.pdf</span>
              <span>p. 2</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;