import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useThemeStore, THEMES } from '../store/useThemeStore';

export default function ThemeSelector() {
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
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
  const isLight = currentTheme === 'light-pro';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm group cursor-pointer ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800 hover:border-blue-400'
            : 'bg-slate-900 border-slate-700 hover:border-cyan-400 text-slate-100'
        }`}
        title="Switch UI Theme"
      >
        <span
          className="w-2.5 h-2.5 rounded-full shadow-sm ring-1 ring-black/10 transition-all duration-200 group-hover:scale-125"
          style={{
            backgroundColor: activeObj.accent,
            boxShadow: `0 0 10px ${activeObj.accent}`
          }}
        />
        <span className="hidden sm:inline font-mono">{activeObj.name}</span>
        <Palette className={`w-3.5 h-3.5 transition-colors ${isLight ? 'text-slate-400 group-hover:text-blue-600' : 'text-slate-400 group-hover:text-cyan-400'}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-72 rounded-2xl border shadow-2xl p-3.5 z-[100] animate-in fade-in zoom-in-95 duration-150 ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900 shadow-xl ring-1 ring-black/5'
              : 'bg-[#0B1120] border-slate-700/80 text-white shadow-2xl ring-1 ring-white/10'
          }`}
          style={{
            backgroundColor: isLight ? '#ffffff' : '#0B1120',
            opacity: 1
          }}
        >
          <div className={`flex items-center justify-between px-1 pb-2.5 mb-2 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Theme Palette
            </span>
            <span
              className="text-[9px] font-mono px-2 py-0.5 rounded-full font-semibold shadow-sm"
              style={{
                backgroundColor: `${activeObj.accent}18`,
                color: activeObj.accent,
                border: `1px solid ${activeObj.accent}40`
              }}
            >
              Active
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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? isLight
                        ? 'bg-blue-50/80 text-blue-900 font-bold border border-blue-400/60 shadow-sm'
                        : 'bg-slate-800/90 text-white font-bold border border-cyan-400/60 shadow-sm'
                      : isLight
                      ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm transition-transform duration-150"
                      style={{
                        backgroundColor: th.accent,
                        boxShadow: isSelected ? `0 0 12px ${th.accent}` : `0 0 4px ${th.accent}80`
                      }}
                    />
                    <div>
                      <div className="leading-tight font-medium">
                        {th.name}
                      </div>
                      <div className={`text-[10px] leading-tight ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {th.desc}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check
                      className="w-4 h-4 shrink-0 stroke-[2.5]"
                      style={{ color: activeObj.accent }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
