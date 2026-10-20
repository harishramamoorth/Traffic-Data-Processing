import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone,
  Mail,
  Copy,
  Check,
  ShieldCheck,
  MapPin,
  LayoutDashboard,
  Database,
  BookOpen,
  Settings,
  Globe,
  ExternalLink,
  Code2
} from 'lucide-react';
import './ProjectFooter.css';

const PHONE_DISPLAY = '+971 58 217 7359';
const PHONE_LINK = 'tel:+971582177359';
const EMAIL = 'harishramu9344@gmail.com';
const PORTFOLIO_URL = 'https://harishportfolio-eight.vercel.app/';
const GITHUB_URL = 'https://github.com/harishramamoorthy';

// Standard GitHub SVG Icon
function GithubIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function ProjectFooter() {
  const year = new Date().getFullYear();
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = (text, field, e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <footer className="pf" role="contentinfo" aria-label="Platform Footer">
      {/* Aurora Ambient & Glowing Top Line */}
      <div className="pf__glow" aria-hidden="true" />
      <div className="pf__ambient" aria-hidden="true" />

      <div className="pf__inner">
        {/* Brand & Author Column */}
        <div className="pf__brand">
          <span className="pf__eyebrow">
            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
            ENGINEERED BY
          </span>

          <div className="pf__brand-head">
            <div className="pf__avatar" aria-hidden="true">
              H
            </div>
            <div>
              <h3 className="pf__name">Harish</h3>
              <span className="pf__role">Full-Stack Data & Privacy Systems Engineer</span>
            </div>
          </div>

          <p className="pf__project">
            Production-grade vehicular mobility microdata de-identification platform. Implements
            cryptographic HMAC-SHA256 pseudonymization, k-anonymity enforcement, spatial coordinate
            jittering, and 9 automated data quality gates.
          </p>

          {/* Developer Links */}
          <div className="flex items-center gap-2 mb-3">
            <a
              href={PORTFOLIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all hover:scale-[1.02]"
              title="Visit Harish's Portfolio"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Portfolio</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-theme-secondary hover:bg-theme-secondary/80 text-theme-text border border-theme-border transition-all hover:scale-[1.02]"
              title="View GitHub Profile"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </div>

          <div className="pf__tags">
            <span className="pf__tag">HMAC-SHA256</span>
            <span className="pf__tag">k-Anonymity (k ≥ 3)</span>
            <span className="pf__tag">ISO/IEC 27001</span>
            <span className="pf__tag">Ephemeral IO</span>
            <span className="pf__tag">Zero Residual PII</span>
          </div>
        </div>

        {/* Platform Quick Links Column */}
        <div className="pf__nav">
          <span className="pf__eyebrow">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            NAVIGATION
          </span>

          <ul className="pf__nav-list">
            <li>
              <Link to="/" className="pf__nav-link">
                <LayoutDashboard />
                <span>Dashboard & Pipeline</span>
              </Link>
            </li>
            <li>
              <Link to="/jobs" className="pf__nav-link">
                <Database />
                <span>Jobs Repository</span>
              </Link>
            </li>
            <li>
              <Link to="/methodology" className="pf__nav-link">
                <BookOpen />
                <span>Privacy Methodology</span>
              </Link>
            </li>
            <li>
              <Link to="/settings" className="pf__nav-link">
                <Settings />
                <span>Security Engine Settings</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Direct Contact Column */}
        <div className="pf__contact">
          <span className="pf__eyebrow">
            <Phone className="w-3.5 h-3.5 text-cyan-400" />
            DIRECT CONTACT
          </span>

          <div className="pf__contact-items">
            {/* Portfolio Link Card */}
            <div className="pf__contact-card">
              <a
                className="pf__link"
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Portfolio in new tab"
              >
                <Globe className="pf__icon" />
                <span className="text-[12px]">Portfolio</span>
              </a>
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="pf__copy-btn"
                title="Open external link"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* GitHub Link Card */}
            <div className="pf__contact-card">
              <a
                className="pf__link"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="Open GitHub Profile"
              >
                <GithubIcon className="pf__icon" />
                <span className="text-[12px]">harishramamoorthy</span>
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="pf__copy-btn"
                title="Open external link"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Phone Card */}
            <div className="pf__contact-card">
              <a className="pf__link" href={PHONE_LINK} title="Call Harish">
                <Phone className="pf__icon" />
                <span className="text-[12px]">{PHONE_DISPLAY}</span>
              </a>
              <button
                type="button"
                className="pf__copy-btn"
                onClick={(e) => handleCopy(PHONE_DISPLAY, 'phone', e)}
                title="Copy phone number"
                aria-label="Copy phone number"
              >
                {copiedField === 'phone' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Email Card */}
            <div className="pf__contact-card">
              <a className="pf__link" href={`mailto:${EMAIL}`} title="Email Harish">
                <Mail className="pf__icon" />
                <span className="text-[12px]">{EMAIL}</span>
              </a>
              <button
                type="button"
                className="pf__copy-btn"
                onClick={(e) => handleCopy(EMAIL, 'email', e)}
                title="Copy email address"
                aria-label="Copy email address"
              >
                {copiedField === 'email' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="pf__location">
            <MapPin className="w-3 h-3 text-cyan-400" />
            <span>Dubai, United Arab Emirates (UTC+4)</span>
          </div>
        </div>
      </div>

      {/* Bottom Legal & Live Status Bar */}
      <div className="pf__bottom">
        <div className="pf__bottom-inner">
          <div className="flex items-center gap-2">
            <span>© {year} Harish. All rights reserved.</span>
            <span className="text-theme-border">•</span>
            <span className="pf__badge">Traffic Data Platform</span>
          </div>

          <div className="pf__status">
            <span className="pf__status-dot" aria-hidden="true" />
            <span>Operational • Privacy Engine Active (QC-01 to QC-09)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}