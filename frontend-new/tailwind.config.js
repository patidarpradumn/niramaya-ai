/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D7377',
          dark: '#095456',
          light: '#14919B',
        },
        secondary: {
          DEFAULT: '#E85A4F',
          dark: '#D44840',
        },
        accent: {
          DEFAULT: '#F5B041',
          dark: '#E5A030',
        },
        surface: '#FFFFFF',
        background: '#F8F9FA',
        'text-primary': '#212529',
        'text-secondary': '#6C757D',
        success: '#28A745',
        warning: '#FFC107',
        error: '#DC3545',
        border: '#DEE2E6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}