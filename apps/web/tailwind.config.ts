import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', lg: '2rem' },
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'ui-serif', 'serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Emerald + violet theme tokens (also defined as CSS vars in globals.css)
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          soft: 'hsl(var(--primary-soft))',
          deep: 'hsl(var(--primary-deep))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          soft: 'hsl(var(--accent-soft))',
          deep: 'hsl(var(--accent-deep))',
        },
        ink: 'hsl(var(--ink))',
        bg: 'hsl(var(--bg))',
        surface: 'hsl(var(--surface))',
        well: 'hsl(var(--well))',
        border: 'hsl(var(--border))',
        text: 'hsl(var(--text))',
        muted: 'hsl(var(--muted))',
        danger: 'hsl(var(--danger))',
        warn: 'hsl(var(--warn))',
        success: 'hsl(var(--success))',
      },
      backgroundImage: {
        // Vivid, for buttons/active states — green through an indigo bridge into violet.
        'brand-gradient':
          'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--gradient-mid)) 55%, hsl(var(--accent)) 100%)',
        // Airy, for banners/placeholders/backgrounds — literal white/green/violet trio.
        'brand-gradient-soft':
          'linear-gradient(135deg, hsl(var(--primary-soft)) 0%, hsl(0 0% 100%) 50%, hsl(var(--accent-soft)) 100%)',
        'radial-fade': 'radial-gradient(circle at top left, hsl(var(--primary) / 0.25), transparent 60%)',
      },
      borderRadius: { lg: '12px', md: '10px', sm: '6px', xl: '20px', '2xl': '28px' },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        elevated: '0 8px 24px -8px rgba(6,78,59,0.16), 0 2px 8px -2px rgba(88,28,135,0.08)',
        glow: '0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px -15px rgba(124,58,237,0.4), 0 10px 36px -12px rgba(16,185,129,0.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(2%, -4%) scale(1.05)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-3%, 3%) scale(1.08)' },
        },
        'loading-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(50%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 14s ease-in-out infinite',
        'float-slow': 'float-slow 18s ease-in-out infinite',
        'loading-bar': 'loading-bar 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
