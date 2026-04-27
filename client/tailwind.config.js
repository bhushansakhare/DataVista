/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
        soft: '0 2px 16px -4px rgba(15, 23, 42, 0.08)',
        ring: '0 0 0 1px rgba(99,102,241,0.2), 0 8px 24px -8px rgba(99,102,241,0.35)',
      },
      backgroundImage: {
        'mesh-light':
          'radial-gradient(at 10% 0%, rgba(99,102,241,0.15) 0px, transparent 50%), radial-gradient(at 90% 0%, rgba(168,85,247,0.12) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(56,189,248,0.10) 0px, transparent 50%)',
        'mesh-dark':
          'radial-gradient(at 10% 0%, rgba(99,102,241,0.18) 0px, transparent 50%), radial-gradient(at 90% 0%, rgba(168,85,247,0.15) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(56,189,248,0.10) 0px, transparent 50%)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        shimmer: 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};
