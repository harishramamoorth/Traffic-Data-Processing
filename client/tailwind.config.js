/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          bg: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
          border: 'var(--border-subtle)',
          text: 'var(--text-main)',
          muted: 'var(--text-muted)',
          dim: 'var(--text-dim)',
          accent: 'var(--accent-primary)',
          accent2: 'var(--accent-secondary)',
          success: 'var(--accent-emerald)',
          warning: 'var(--accent-amber)',
          danger: 'var(--accent-rose)'
        }
      },
      boxShadow: {
        'theme-glow': '0 0 25px var(--accent-glow)',
        'theme-glow-lg': '0 0 45px var(--accent-glow)'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'shimmer': 'shimmer 1.5s infinite'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        }
      }
    },
  },
  plugins: [],
}
