/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--background)',
          surface: 'var(--surface)',
          soft: 'var(--surface-soft)',
          muted: 'var(--surface-muted)',
        },
        txt: {
          primary: 'var(--text-primary)',
          heading: 'var(--text-heading)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          disabled: 'var(--text-disabled)',
          nav: 'var(--text-nav-inactive)',
        },
        bdr: {
          subtle: 'var(--border)',
          strong: 'var(--border-strong)',
          divider: 'var(--divider)',
        },
        supergas: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          pressed: 'var(--brand-pressed)',
          light: 'var(--brand-light)',
          soft: 'var(--brand-soft)',
          border: 'var(--brand-border)',
        },
        semantic: {
          success: 'var(--success)',
          'success-soft': 'var(--success-soft)',
          warning: 'var(--warning)',
          'warning-soft': 'var(--warning-soft)',
          danger: 'var(--danger)',
          'danger-soft': 'var(--danger-soft)',
          info: 'var(--info)',
          'info-soft': 'var(--info-soft)',
        }
      },
    },
  },
  plugins: [],
}
