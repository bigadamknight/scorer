/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: 'oklch(0.97 0.008 295)',
        surface: 'oklch(0.995 0.003 295)',
        ink: 'oklch(0.24 0.03 295)',
        faint: 'oklch(0.52 0.03 295)',
        hairline: 'oklch(0.90 0.012 295)',
        violet: {
          DEFAULT: 'oklch(0.45 0.19 295)',
          deep: 'oklch(0.32 0.12 295)',
          wash: 'oklch(0.93 0.03 295)',
        },
        made: 'oklch(0.55 0.15 150)',
        missed: 'oklch(0.55 0.19 25)',
        clock: 'oklch(0.72 0.14 85)',
      },
      fontFamily: {
        display: ['"Saira Condensed"', '"Arial Narrow"', 'sans-serif'],
        body: ['Chivo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
