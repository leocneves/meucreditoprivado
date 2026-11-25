/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './generate_prerender.py',
    './scripts/prerender_hubs.py',
    '/home/home/airflow/src/cp_noticias/**/*.py',
  ],
  theme: {
    extend: {
      boxShadow: {
        '2xs': '0 1px 0 0 rgb(0 0 0 / 0.05)',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      backdropBlur: {
        xs: '2px',
      },
      width: {
        88: '22rem',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
