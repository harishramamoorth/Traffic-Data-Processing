import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import {
  ShieldCheck,
  LayoutDashboard,
  Database,
  BookOpen,
  Settings as SettingsIcon,
  Menu,
  X,
  Activity
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetails from './pages/JobDetails';
import Methodology from './pages/Methodology';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import ThemeSelector from './components/ThemeSelector';
import { ToastProvider } from './components/Toast';
import PageLoadingBar from './components/PageLoadingBar';
import PageLoader from './components/PageLoader';

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ToastProvider>
      <BrowserRouter>
        <PageLoadingBar />
        <div className="min-h-screen flex flex-col bg-theme-bg text-theme-text transition-colors duration-300">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-50 backdrop-blur-xl bg-theme-bg/85 border-b border-theme-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
              {/* Brand Logo */}
              <Link to="/" className="flex items-center gap-3 text-theme-text group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-500 p-0.5 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                  <div className="w-full h-full bg-black/80 rounded-[10px] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm sm:text-base tracking-tight leading-none text-theme-text">
                    Traffic<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Processor</span>
                  </span>
                  <span className="text-[10px] font-mono text-theme-dim leading-tight">
                    Data Privacy Platform
                  </span>
                </div>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-1.5">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                        : 'text-theme-muted hover:text-theme-text hover:bg-theme-secondary'
                    }`
                  }
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </NavLink>

                <NavLink
                  to="/jobs"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                        : 'text-theme-muted hover:text-theme-text hover:bg-theme-secondary'
                    }`
                  }
                >
                  <Database className="w-4 h-4" />
                  <span>Jobs Repository</span>
                </NavLink>

                <NavLink
                  to="/methodology"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                        : 'text-theme-muted hover:text-theme-text hover:bg-theme-secondary'
                    }`
                  }
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Methodology</span>
                </NavLink>

                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                        : 'text-theme-muted hover:text-theme-text hover:bg-theme-secondary'
                    }`
                  }
                >
                  <SettingsIcon className="w-4 h-4" />
                  <span>Settings</span>
                </NavLink>
              </nav>

              {/* Right Menu: Engine Status & Theme Selector */}
              <div className="flex items-center gap-3">
                <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Pipeline Live</span>
                </div>

                <ThemeSelector />

                {/* Mobile Hamburger Toggle */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-xl bg-theme-secondary border border-theme-border text-theme-muted hover:text-theme-text"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Mobile Nav Menu Drawer */}
            {mobileMenuOpen && (
              <div className="md:hidden border-t border-theme-border bg-theme-card/95 backdrop-blur-xl px-4 py-3 space-y-2">
                <NavLink
                  to="/"
                  end
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-text hover:bg-theme-secondary"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </NavLink>
                <NavLink
                  to="/jobs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-text hover:bg-theme-secondary"
                >
                  <Database className="w-4 h-4" />
                  <span>Jobs Repository</span>
                </NavLink>
                <NavLink
                  to="/methodology"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-text hover:bg-theme-secondary"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Methodology</span>
                </NavLink>
                <NavLink
                  to="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-text hover:bg-theme-secondary"
                >
                  <SettingsIcon className="w-4 h-4" />
                  <span>Settings</span>
                </NavLink>
              </div>
            )}
          </header>

          {/* Main App Container */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/:id" element={<JobDetails />} />
              <Route path="/methodology" element={<Methodology />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>

          {/* SaaS Footer */}
          <footer className="border-t border-theme-border/60 py-6 text-center text-xs font-mono text-theme-dim bg-theme-bg/50">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Road Traffic Data Privacy & Processing Platform • Zero Raw Data Retention</span>
              </span>
              <span className="text-theme-dim">
                HMAC-SHA256 • QC-01 to QC-08 Validated • MongoDB Atlas & Local
              </span>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}
