/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bank: {
          50: '#f0f7ff',
          100: '#dfeefc',
          200: '#bfdcff',
          300: '#8cc3ff',
          400: '#4fa0ff',
          500: '#2b83ff',
          600: '#1e68d6',
          700: '#1d54b4',
          800: '#1d447f',
          900: '#1a3658'
        }
      },
      boxShadow: {
        soft: '0 24px 60px rgba(15, 23, 42, 0.32)'
      }
    }
  },
  plugins: []
};
