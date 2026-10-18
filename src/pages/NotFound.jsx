import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="space-y-1">
        <h1 className="text-4xl font-extrabold text-theme-text font-mono">404</h1>
        <h2 className="text-lg font-bold text-theme-muted">Telemetry Route Not Found</h2>
        <p className="text-xs text-theme-dim max-w-sm mx-auto">
          The requested path does not exist or has been sanitized by privacy protocols.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-black text-xs font-bold shadow-lg shadow-cyan-500/20"
        >
          <Home className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
