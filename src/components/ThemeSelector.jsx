import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Sparkles, Zap, EyeOff } from 'lucide-react';
import { useThemeStore, THEMES } from '../store/useThemeStore';

export default function ThemeSelector() {
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const animLevel = useThemeStore((s) => s.animationLevel);
  const setAnimationLevel = useThemeStore((s) => s.setAnimationLevel);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeObj = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-theme-secondary border border-theme-border hover:border-theme-accent/40 text-xs font-semibold text-theme-text transition-all shadow-sm"
        title="Switch UI Theme & Animation"
      >
        <span
          className="w-3 h-3 rounded-full shadow-sm ring-2 ring-black/20"
          style={{ backgroundColor: activeObj.accent }}
        />
        <span className="hidden sm:inline font-mono">{activeObj.name}</span>
        <Palette className="w-3.5 h-3.5 text-theme-dim" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-theme-card border border-theme-border shadow-2xl p-2.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-2 py-1 border-b border-theme-border/60 pb-2 mb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-theme-dim">
              UI Theme Palette
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-theme-secondary text-theme-accent font-semibold">
              Live
            </span>
          </div>

          <div className="space-y-1">
            {THEMES.map((th) => {
              const isSelected = th.id === currentTheme;
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    setTheme(th.id);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all ${
                    isSelected
                      ? 'bg-theme-secondary text-theme-text font-bold border border-theme-border shadow-sm'
                      : 'text-theme-muted hover:text-theme-text hover:bg-theme-secondary/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{
                        backgroundColor: th.accent,
                        boxShadow: isSelected ? `0 0 10px ${th.accent}` : 'none'
                      }}
                    />
                    <div>
                      <div className="leading-tight font-medium">{th.name}</div>
                      <div className="text-[10px] text-theme-dim leading-tight">{th.desc}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-theme-accent shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Quick Animation Intensity Toggle */}
          <div className="mt-2.5 pt-2 border-t border-theme-border/60">
            <div className="text-[10px] font-mono uppercase tracking-wider text-theme-dim px-2 mb-1.5">
              Animation Workload
            </div>
            <div className="grid grid-cols-3 gap-1 bg-theme-secondary p-1 rounded-xl">
              {[
                { id: 'full', label: 'Full 60FPS', icon: Zap },
                { id: 'reduced', label: 'Balanced', icon: Sparkles },
                { id: 'off', label: 'Static', icon: EyeOff }
              ].map((lvl) => {
                const isAct = animLevel === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setAnimationLevel(lvl.id)}
                    className={`flex flex-col items-center gap-0.5 py-1 px-1 rounded-lg text-[9px] font-mono transition-all ${
                      isAct
                        ? 'bg-theme-card text-theme-accent font-bold shadow-sm'
                        : 'text-theme-dim hover:text-theme-text'
                    }`}
                  >
                    <lvl.icon className="w-3 h-3" />
                    <span>{lvl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
