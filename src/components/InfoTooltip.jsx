import React, { useState } from 'react';
import { Info } from 'lucide-react';

export const TOOLTIP_DEFINITIONS = {
  'k-anonymity': 'Ensures each record cannot be distinguished from at least k-1 other individuals with the same quasi-identifiers.',
  'hmac': 'Cryptographic keyed hashing that turns identifiers into pseudonyms using a secret key without storing the original value.',
  'generalization': 'Reduces precision (like rounding GPS coordinates) so individual locations blend into broader areas.',
  'bucketing': 'Groups timestamps or continuous values into discrete intervals to prevent pinpointing exact events.'
};

/**
 * Accessible InfoTooltip component with keyboard focus and WCAG AA contrast
 */
export default function InfoTooltip({ term, text, className = '' }) {
  const [open, setOpen] = useState(false);
  const content = text || TOOLTIP_DEFINITIONS[term?.toLowerCase()] || '';

  if (!content) return null;

  return (
    <span className={`relative inline-flex items-center ml-1 align-middle ${className}`}>
      <button
        type="button"
        aria-label={`Info: ${term || 'Definition'}`}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="p-0.5 rounded-full text-theme-dim hover:text-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-colors cursor-help"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 p-2.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-sans font-normal leading-relaxed shadow-xl border border-theme-border z-50 pointer-events-none"
        >
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
}
