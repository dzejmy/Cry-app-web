/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'scale-in':   'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'bounce-in':  'bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' },                    to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:  { from: { opacity: '0', transform: 'scale(0.8)' },      to: { opacity: '1', transform: 'scale(1)' } },
        bounceIn: { from: { opacity: '0', transform: 'scale(0.6)' },      to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
}

