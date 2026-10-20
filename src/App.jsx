import React, { useState, useEffect } from 'react';
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
import { useWorkflowStore } from './store/useWorkflowStore';
import BackgroundVideo from './components/3d/Backgroundvideo';
import ProjectFooter from './pages/ProjectFooter';

export default function App() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentStep = useWorkflowStore((s) => s.currentStep);

  // Fallback safety timer so initial page loading never hangs
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  if (initialLoading) {
    return <PageLoader variant="hud" onComplete={() => setInitialLoading(false)} />;
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <PageLoadingBar />
        <div className="min-h-screen flex flex-col bg-transparent text-theme-text relative">
          <BackgroundVideo />
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-50 backdrop-blur-2xl bg-theme-bg/85 border-b border-theme-border shadow-sm transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
              {/* Brand Logo */}
              <Link to="/" className="flex items-center gap-3 text-theme-text group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-theme-accent via-indigo-500 to-cyan-400 p-0.5 shadow-md shadow-theme-glow group-hover:scale-105 transition-all duration-200">
                  <div className="w-full h-full bg-theme-card rounded-[10px] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-theme-accent group-hover:scale-110 transition-transform duration-200" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm sm:text-base tracking-tight leading-none text-theme-text">
                    Traffic<span className="text-theme-accent drop-shadow-[0_0_10px_var(--accent-glow)]">Processor</span>
                  </span>
                  <span className="text-[10px] font-mono text-theme-dim leading-tight">
                    Data Privacy Platform
                  </span>
                </div>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-2">
                {[
                  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
                  { to: '/jobs', label: 'Jobs Repository', icon: Database, end: false },
                  { to: '/methodology', label: 'Methodology', icon: BookOpen, end: false },
                  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false }
                ].map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `group relative px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-150 ${
                        isActive
                          ? 'bg-theme-accent/15 text-theme-accent border border-theme-accent/50 shadow-theme-glow font-bold'
                          : 'text-theme-muted hover:text-theme-text hover:bg-theme-secondary/80 border border-transparent'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 transition-transform duration-150 group-hover:scale-110 group-hover:-translate-y-0.5" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>

              {/* Right Menu: Active Job Shortcut, Engine Health Check & Theme Selector */}
              <div className="flex items-center gap-3">
                {/* Active job step shortcut if in progress */}
                {currentStep > 1 && (
                  <Link
                    to="/"
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-theme-accent/10 border border-theme-accent/30 text-theme-accent text-[11px] font-mono hover:bg-theme-accent/20 transition-colors shadow-sm"
                    title="Continue current active job in wizard"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-theme-accent animate-pulse" />
                    <span>Active: Step {currentStep}</span>
                    <span className="font-bold">&rarr;</span>
                  </Link>
                )}

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

          {/* Platform Footer */}
          <ProjectFooter />
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}
