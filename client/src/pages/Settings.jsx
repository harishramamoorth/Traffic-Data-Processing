import React from 'react';
import { Settings as SettingsIcon, Palette, Zap, Sparkles, Check, Monitor } from 'lucide-react';
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
    { id: 'full', name: 'Full (60 FPS)', desc: '3D particle stream, smooth Framer Motion transitions' },
    { id: 'reduced', name: 'Reduced Motion', desc: 'Lightweight 2D fallbacks, minimal animations' },
    { id: 'off', name: 'Off (High Performance)', desc: 'Static rendering for low-power or terminal devices' }
  ];

  return (
    <div className="space-y-8 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-theme-card border border-theme-border shadow-xl space-y-1">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-cyan-400" />
          <h1 className="text-2xl font-bold text-theme-text">Platform Settings & Accessibility</h1>
        </div>
        <p className="text-xs text-theme-dim">
          Configure UI theme palettes, animation complexity, and default compliance presets.
        </p>
      </div>

      {/* 1. Theme Selection */}
      <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-theme-text uppercase tracking-wider">UI Theme Palette</h2>
        </div>
        <p className="text-xs text-theme-dim">
          Switch among 5 curated palettes. Charts, 3D scenes, badges, and gradients update automatically.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {THEMES.map((th) => {
            const isSelected = th.id === theme;
            return (
              <button
                key={th.id}
                type="button"
                onClick={() => {
                  setTheme(th.id);
                  addToast(`Theme switched to ${th.name}.`, 'info');
                }}
                className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-theme-secondary border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400'
                    : 'bg-theme-secondary/40 border-theme-border hover:border-theme-border/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-sm"
                      style={{ backgroundColor: th.accent }}
                    />
                    <span className="text-xs font-bold text-theme-text">{th.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <p className="text-[11px] text-theme-dim mt-2">{th.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Animation Level */}
      <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold text-theme-text uppercase tracking-wider">Animation & GPU Workload</h2>
        </div>
        <p className="text-xs text-theme-dim">
          Control Framer Motion transitions and Three.js 3D rendering. Respects prefers-reduced-motion.
        </p>

        <div className="space-y-2.5 pt-1">
          {ANIM_LEVELS.map((lvl) => {
            const isSelected = animationLevel === lvl.id;
            return (
              <div
                key={lvl.id}
                onClick={() => {
                  setAnimationLevel(lvl.id);
                  addToast(`Animation mode set to ${lvl.name}.`, 'info');
                }}
                className={`p-4 rounded-xl cursor-pointer border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-purple-500/10 border-purple-500 shadow-sm'
                    : 'bg-theme-secondary/40 border-theme-border hover:bg-theme-secondary/70'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-theme-text">{lvl.name}</span>
                    {isSelected && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-theme-dim mt-0.5">{lvl.desc}</p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-purple-400" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Default Privacy Preset */}
      <div className="p-6 rounded-2xl bg-theme-card border border-theme-border space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-theme-text uppercase tracking-wider">Default Privacy Preset</h2>
        </div>
        <p className="text-xs text-theme-dim">
          Default policy applied when loading new datasets in the wizard.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {Object.entries(PRESETS).map(([key, p]) => {
            const isSelected = activePreset === key;
            return (
              <div
                key={key}
                onClick={() => {
                  applyPreset(key);
                  addToast(`Default preset set to ${p.name}.`, 'info');
                }}
                className={`p-4 rounded-xl cursor-pointer border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500 shadow-sm'
                    : 'bg-theme-secondary/40 border-theme-border hover:bg-theme-secondary/70'
                }`}
              >
                <div>
                  <span className="text-xs font-bold text-theme-text block">{p.name}</span>
                  <span className="text-[10px] font-mono text-emerald-400">{p.badge}</span>
                  <p className="text-[11px] text-theme-dim mt-1">{p.desc}</p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-emerald-400 self-end mt-2" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
