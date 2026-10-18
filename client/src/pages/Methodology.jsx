import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  KeyRound,
  MapPin,
  Clock,
  Trash2,
  EyeOff,
  AlertTriangle,
  ChevronDown,
  Info,
  CheckCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const TECHNIQUES = [
  {
    id: 'data-minimization',
    title: '1. Data Minimization (Direct Identifier Dropping)',
    tag: 'GDPR Art. 5(1)(c)',
    icon: Trash2,
    color: 'rose',
    summary:
      'Completely excising high-risk direct personal identifiers (SSNs, driver names, phone numbers, email addresses) from dataset storage.',
    whyChosen:
      'Urban mobility analytics, traffic congestion modeling, and route planning have zero legitimate analytical necessity for individual human names or SSNs. Retaining direct identifiers exposes municipal agencies to severe civil liabilities and privacy breaches.',
    limits:
      'Prevents driver-level personalization or linking infractions back to specific individuals (which is the intended privacy goal for non-enforcement analytics).',
    example: {
      before: '{ "driver_name": "Alexander Wright", "driver_ssn": "102-45-7890", "speed_mph": 34.5 }',
      after: '{ "speed_mph": 34.5 }'
    }
  },
  {
    id: 'hmac-pseudonymization',
    title: '2. Cryptographic HMAC-SHA256 Pseudonymization',
    tag: 'Deterministic Hashing',
    icon: KeyRound,
    color: 'cyan',
    summary:
      'Transforms vehicle license plates into irreversible cryptographic pseudonyms (format ANON_<first 12 hex>) keyed by an environmental salt secret.',
    whyChosen:
      'Enables vital longitudinal fleet analysis, origin-destination matrices, and recurring route pattern detection without ever storing or revealing real-world registration plates. Same plate + same key produces the same pseudonym across batches.',
    limits:
      'Vulnerable to brute-force dictionary attacks if the secret key is leaked or if the plate entropy space is small; protected by ensuring the secret key is kept strictly in server-side environment variables and rotated periodically.',
    example: {
      before: '{ "vehicle_plate": "NYC-8492" }',
      after: '{ "vehicle_plate": "ANON_8c7f21a4e9b0" }'
    }
  },
  {
    id: 'spatial-generalization',
    title: '3. Spatial Generalization (GPS Decimals Floor)',
    tag: 'Location Obfuscation',
    icon: MapPin,
    color: 'emerald',
    summary:
      'Truncates raw centimeter-accurate GPS coordinates down to 2 decimal places (~1.1 km bounding box grid).',
    whyChosen:
      'Pinpoint coordinates routinely leak exact residential driveways, sensitive medical clinics, and workplace parking bays. A ~1.1 km grid cell maintains aggregate road segment density while providing spatial k-anonymity.',
    limits:
      'Precludes lane-level micro-navigation or localized intersection collision reconstruction.',
    example: {
      before: '{ "latitude": 40.712776, "longitude": -74.005974 }',
      after: '{ "latitude": 40.71, "longitude": -74.01 }'
    }
  },
  {
    id: 'temporal-bucketing',
    title: '4. Temporal Bucketing (15-Minute Floor)',
    tag: 'Temporal Privacy',
    icon: Clock,
    color: 'blue',
    summary:
      'Rounds exact timestamps (seconds and milliseconds) down to 15-minute UTC intervals in ISO-8601 format.',
    whyChosen:
      'Millisecond timestamps enable cross-correlation with external CCTV surveillance footage, automatic toll booths, or mobile cell-tower pings. 15-minute floor bucketing decouples the event from exact clock-time correlations.',
    limits:
      'Smoothes out instantaneous speed spikes across short sub-second braking intervals.',
    example: {
      before: '{ "timestamp": "2026-10-17 07:44:45.192" }',
      after: '{ "timestamp": "2026-10-17T07:30:00Z" }'
    }
  },
  {
    id: 'freetext-redaction',
    title: '5. Automated Free-Text Scrubbing',
    tag: 'Incidental Leakage',
    icon: EyeOff,
    color: 'purple',
    summary:
      'Scans unstructured dispatcher notes, road segment comments, and officer logs for regex patterns of plates, phones, and SSNs, replacing them with standardized redaction tokens.',
    whyChosen:
      'Operators and dispatchers frequently jot down driver contact numbers, plates, or personal notes into informal commentary fields. Automated scrubbing stops incidental leakage.',
    limits:
      'Regexes may occasionally redact non-PII strings that resemble telephone or plate patterns, or miss obfuscated colloquial text.',
    example: {
      before: '{ "road_segment": "Broadway North (call 212-555-0199)" }',
      after: '{ "road_segment": "Broadway North (call [REDACTED_PHONE])" }'
    }
  },
  {
    id: 'non-clamping-outliers',
    title: '6. Non-Clamping Outlier Auditing',
    tag: 'Data Veracity',
    icon: AlertTriangle,
    color: 'amber',
    summary:
      'Preserves original telemetry measurements above 120 mph by attaching `speed_outlier_flag = true` rather than silently clamping or altering numbers.',
    whyChosen:
      'Silently mutating speed values (e.g. overwriting 145 mph to 120 mph) severely compromises forensic crash investigations, emergency responder analysis, and scientific research veracity.',
    limits:
      'Requires downstream consumers to actively filter on `speed_outlier_flag` if computing simple averages that would be skewed by anomalous outliers.',
    example: {
      before: '{ "speed_mph": 135.2 }',
      after: '{ "speed_mph": 135.2, "speed_outlier_flag": true }'
    }
  }
];

export default function Methodology() {
  const [expandedId, setExpandedId] = useState('data-minimization');

  return (
    <div className="space-y-10 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-medium">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Scientific Privacy Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-theme-text tracking-tight">
          Privacy Engineering Methodology & Limits
        </h1>
        <p className="text-sm text-theme-muted max-w-2xl mx-auto leading-relaxed">
          Comprehensive documentation of mathematical anonymization models, regulatory rationales, and analytical trade-offs applied across the pipeline.
        </p>
      </div>

      {/* Explainer Cards Accordion */}
      <div className="space-y-4">
        {TECHNIQUES.map((tech) => {
          const Icon = tech.icon;
          const isExpanded = expandedId === tech.id;

          return (
            <motion.div
              key={tech.id}
              layout
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                isExpanded
                  ? 'bg-theme-card border-theme-border shadow-xl'
                  : 'bg-theme-card/70 border-theme-border/60 hover:border-theme-border hover:bg-theme-card'
              }`}
            >
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : tech.id)}
                className="w-full flex items-center justify-between p-5 text-left transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      tech.color === 'rose'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : tech.color === 'cyan'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        : tech.color === 'emerald'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : tech.color === 'blue'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : tech.color === 'purple'
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-theme-text">{tech.title}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-theme-secondary text-theme-muted border border-theme-border hidden sm:inline">
                        {tech.tag}
                      </span>
                    </div>
                    <p className="text-xs text-theme-dim mt-0.5 line-clamp-1">{tech.summary}</p>
                  </div>
                </div>

                <div
                  className={`p-1 rounded-lg text-theme-dim transition-transform duration-200 ${
                    isExpanded ? 'rotate-180 text-cyan-400' : ''
                  }`}
                >
                  <ChevronDown className="w-5 h-5" />
                </div>
              </button>

              {/* Accordion Body */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="px-5 pb-6 pt-2 border-t border-theme-border/50 space-y-5"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                      {/* Why Chosen */}
                      <div className="p-4 rounded-xl bg-theme-secondary/40 border border-theme-border/50 space-y-1.5">
                        <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" /> Why This Technique Was Chosen
                        </span>
                        <p className="text-theme-muted text-[11px]">{tech.whyChosen}</p>
                      </div>

                      {/* Known Limitations */}
                      <div className="p-4 rounded-xl bg-theme-secondary/40 border border-theme-border/50 space-y-1.5">
                        <span className="font-bold text-amber-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Technical Limitations & Trade-Offs
                        </span>
                        <p className="text-theme-muted text-[11px]">{tech.limits}</p>
                      </div>
                    </div>

                    {/* Before / After Transformation Code Snippet */}
                    <div className="p-4 rounded-xl bg-black/80 border border-theme-border space-y-2 font-mono text-xs">
                      <span className="text-[10px] text-theme-dim uppercase tracking-wider block">
                        Transformation Signature
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                          <span className="text-[9px] text-rose-400 uppercase block font-bold mb-1">Raw Input</span>
                          {tech.example.before}
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                          <span className="text-[9px] text-emerald-400 uppercase block font-bold mb-1">Sanitized Output</span>
                          {tech.example.after}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Action CTA */}
      <div className="text-center pt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black text-xs font-bold shadow-lg shadow-cyan-500/20"
        >
          <span>Launch Pipeline With These Rules</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
