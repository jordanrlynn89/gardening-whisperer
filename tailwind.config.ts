import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Earthy/organic color palette for gardening theme
        earth: {
          50: '#f6f5f0',
          100: '#e8e6d9',
          200: '#d4ceb5',
          300: '#bdb089',
          400: '#a99464',
          500: '#9b8354',
          600: '#876f48',
          700: '#6f593d',
          800: '#5d4b37',
          900: '#4f4032',
        },
        garden: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
    },
  },
  plugins: [],
};

export default config;
