import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-12 h-12 rounded-xl bg-theme-secondary border border-theme-border text-theme-muted flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-theme-dim" />
      </div>

      <div className="space-y-1">
        <span className="text-3xl font-bold font-mono text-theme-text">404</span>
        <h1 className="text-base font-semibold text-theme-text">Page Not Found</h1>
        <p className="text-xs text-theme-muted max-w-sm mx-auto">
          The requested page does not exist or may have been moved.
        </p>
      </div>

      <div className="pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}

