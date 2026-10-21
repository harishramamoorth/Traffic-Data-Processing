import { create } from 'zustand';

export const THEMES = [
  { id: 'light-pro', name: 'Light Pro', accent: '#2563eb', desc: 'Clean white + royal blue' },
  { id: 'midnight', name: 'Midnight', accent: '#06b6d4', desc: 'Dark navy + cyan accent' },
  { id: 'aurora', name: 'Aurora', accent: '#ec4899', desc: 'Dark + purple/pink gradient' },
  { id: 'matrix', name: 'Matrix', accent: '#22c55e', desc: 'Black + green terminal feel' },
  { id: 'high-contrast', name: 'High Contrast', accent: '#ffff00', desc: 'Pure black + yellow contrast' }
];

const getStorage = (key, fallback) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      return window.localStorage.getItem(key) || fallback;
    }
  } catch {}
  return fallback;
};

const setStorage = (key, val) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
      window.localStorage.setItem(key, val);
    }
  } catch {}
};

const savedTheme = getStorage('tdp_theme', 'light-pro');
const savedAnim = getStorage('tdp_anim_level', 'full');

// Apply initial theme attribute to <html> element
if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.documentElement.setAttribute('data-anim', savedAnim);
}

export const useThemeStore = create((set, get) => ({
  theme: savedTheme,
  animationLevel: savedAnim, // 'full' | 'reduced' | 'off'
  reduceMotion: savedAnim === 'reduced' || savedAnim === 'off',

  setTheme: (newTheme) => {
    setStorage('tdp_theme', newTheme);
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    set({ theme: newTheme });
  },

  setAnimationLevel: (level) => {
    setStorage('tdp_anim_level', level);
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-anim', level);
    }
    set({
      animationLevel: level,
      reduceMotion: level === 'reduced' || level === 'off'
    });
  },

  toggleReduceMotion: () => {
    const nextReduced = !get().reduceMotion;
    const nextLevel = nextReduced ? 'reduced' : 'full';
    get().setAnimationLevel(nextLevel);
  },

  getThemeColors: () => {
    const t = get().theme;
    switch (t) {
      case 'aurora':
        return { primary: '#ec4899', secondary: '#a855f7', bg: '#0f0919', card: '#1b102e' };
      case 'matrix':
        return { primary: '#22c55e', secondary: '#10b981', bg: '#030804', card: '#071509' };
      case 'light-pro':
        return { primary: '#2563eb', secondary: '#0284c7', bg: '#f8fafc', card: '#ffffff' };
      case 'high-contrast':
        return { primary: '#ffff00', secondary: '#00ffff', bg: '#000000', card: '#121212' };
      case 'midnight':
        return { primary: '#06b6d4', secondary: '#3b82f6', bg: '#0a0e17', card: '#111827' };
      case 'light-pro':
      default:
        return { primary: '#2563eb', secondary: '#0284c7', bg: '#f8fafc', card: '#ffffff' };
    }
  }
}));
