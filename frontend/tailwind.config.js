/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#1D9E75',
          'green-light': '#E1F5EE',
          'green-dark': '#085041',
          coral: '#D85A30',
          'coral-light': '#FAECE7',
          'coral-dark': '#4A1B0C',
          'amber-light': '#FAEEDA',
          'amber-dark': '#633806',
        },
      },
      fontFamily: {
        sans: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        content: '720px',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};
