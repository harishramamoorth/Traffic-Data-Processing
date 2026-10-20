import React from 'react';
import { Settings as SettingsIcon, Palette, Zap, ShieldCheck, Check } from 'lucide-react';
import { useThemeStore, THEMES } from '../store/useThemeStore';
import { useWorkflowStore, PRESETS } from '../store/useWorkflowStore';
import { useToast } from '../components/Toast';

export default function Settings() {
  const { addToast } = useToast();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const animationLevel = useThemeStore((s) => s.animationLevel);
  const setAnimationLevel = useThemeStore((s) => s.setAnimationLevel);

  const activePreset = useWorkflowStore((s) => s.activePreset);
  const applyPreset = useWorkflowStore((s) => s.applyPreset);

  const ANIM_LEVELS = [
    { id: 'full', name: 'Standard (Full)', desc: 'Smooth transitions and 3D preview' },
    { id: 'reduced', name: 'Reduced Motion', desc: 'Minimal transitions, lower GPU usage' },
    { id: 'off', name: 'Off', desc: 'Static rendering for lower resource usage' }
  ];

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-5 sm:p-6 rounded-xl bg-theme-card border border-theme-border space-y-1">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-indigo-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-theme-text tracking-tight">Settings</h1>
        </div>
        <p className="text-xs text-theme-muted">
          Manage theme palette, animations, and default privacy presets.
        </p>
      </div>

      {/* 1. Theme Selection */}
      <div className="p-5 sm:p-6 rounded-xl bg-theme-card border border-theme-border space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-theme-text flex items-center gap-2">
            <Palette className="w-4 h-4 text-theme-dim" /> Theme
          </h2>
          <p className="text-xs text-theme-dim mt-0.5">
            Choose a visual appearance for the interface.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {THEMES.map((th) => {
            const isSelected = th.id === theme;
            return (
              <button
                key={th.id}
                type="button"
                onClick={() => {
                  setTheme(th.id);
                  addToast(`Theme set to ${th.name}.`, 'info');
                }}
                className={`p-3.5 rounded-lg text-left border transition-colors flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-theme-secondary/70 border-indigo-500 ring-1 ring-indigo-500/50'
                    : 'bg-theme-secondary/30 border-theme-border hover:border-theme-border/80 hover:bg-theme-secondary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: th.accent }}
                    />
                    <span className="text-xs font-semibold text-theme-text">{th.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-500" />}
                </div>
                <p className="text-[11px] text-theme-dim mt-2 leading-snug">{th.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Animation Level */}
      <div className="p-5 sm:p-6 rounded-xl bg-theme-card border border-theme-border space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-theme-text flex items-center gap-2">
            <Zap className="w-4 h-4 text-theme-dim" /> Animations & Motion
          </h2>
          <p className="text-xs text-theme-dim mt-0.5">
            Adjust visual effects and graphics performance.
          </p>
        </div>

        {/* Quick Reduce Motion Toggle */}
        <div className="p-3.5 rounded-lg bg-theme-secondary/30 border border-theme-border flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-theme-text block">Reduce motion</span>
            <p className="text-[11px] text-theme-dim">
              Disable 3D previews and replace animations with instant transitions.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={animationLevel === 'reduced' || animationLevel === 'off'}
            onClick={() => {
              const willReduce = !(animationLevel === 'reduced' || animationLevel === 'off');
              setAnimationLevel(willReduce ? 'reduced' : 'full');
              addToast(willReduce ? 'Reduced motion enabled.' : 'Standard animations enabled.', 'info');
            }}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
              animationLevel === 'reduced' || animationLevel === 'off' ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                animationLevel === 'reduced' || animationLevel === 'off' ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {ANIM_LEVELS.map((lvl) => {
            const isSelected = animationLevel === lvl.id;
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => {
                  setAnimationLevel(lvl.id);
                  addToast(`Animation mode: ${lvl.name}.`, 'info');
                }}
                className={`p-3 rounded-lg text-left border transition-colors flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-theme-secondary/70 border-indigo-500 ring-1 ring-indigo-500/50'
                    : 'bg-theme-secondary/30 border-theme-border hover:border-theme-border/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-theme-text">{lvl.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                </div>
                <p className="text-[11px] text-theme-dim mt-1.5 leading-snug">{lvl.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Default Privacy Preset */}
      <div className="p-5 sm:p-6 rounded-xl bg-theme-card border border-theme-border space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-theme-text flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-theme-accent" /> Default Privacy Policy
          </h2>
          <p className="text-xs text-theme-dim mt-0.5">
            Default protection profile pre-selected for new datasets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(PRESETS).map(([key, p]) => {
            const isSelected = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  applyPreset(key);
                  addToast(`Default preset: ${p.name}.`, 'info');
                }}
                className={`p-3.5 rounded-lg text-left border transition-colors flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-theme-secondary/70 border-indigo-500 ring-1 ring-indigo-500/50'
                    : 'bg-theme-secondary/30 border-theme-border hover:border-theme-border/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-theme-text">{p.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                  </div>
                  <span className="inline-block text-[10px] font-mono text-indigo-500 mt-0.5">{p.badge}</span>
                  <p className="text-[11px] text-theme-dim mt-1 leading-snug">{p.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

