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
      colors: {
        // Light-green + white theme tokens (also defined as CSS vars in globals.css)
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          soft: 'hsl(var(--primary-soft))',
          deep: 'hsl(var(--primary-deep))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        bg: 'hsl(var(--bg))',
        surface: 'hsl(var(--surface))',
        border: 'hsl(var(--border))',
        text: 'hsl(var(--text))',
        muted: 'hsl(var(--muted))',
        danger: 'hsl(var(--danger))',
        warn: 'hsl(var(--warn))',
        success: 'hsl(var(--success))',
      },
      borderRadius: { lg: '12px', md: '10px', sm: '6px' },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
