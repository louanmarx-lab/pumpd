/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#09090B',
          card: '#18181B',
          cardHover: '#27272A',
          border: '#27272A',
          input: '#27272A',
        },
        accent: {
          orange: '#FF6B35',
          orangeLight: '#FF8552',
          emerald: '#10B981',
          emeraldDark: '#059669',
          purple: '#8B5CF6',
          amber: '#F59E0B',
          red: '#EF4444',
          cyan: '#06B6D4',
          cyanLight: '#22D3EE',
          cyanDark: '#0891B2',
        },
        badge: {
          warmup: '#F59E0B',
          normal: '#64748B',
          drop: '#8B5CF6',
          failure: '#EF4444',
        }
      },
    },
  },
  plugins: [],
};
