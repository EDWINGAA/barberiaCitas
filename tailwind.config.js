/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Acentos dorados de la marca
        gold: {
          50: '#FBF8EC',
          100: '#F6EFCF',
          200: '#EBDD9F',
          300: '#DFC96C',
          400: '#D4B443',
          500: '#C9A227',
          600: '#A9841E',
          700: '#846518',
          800: '#5E4812',
          900: '#3C2E0C',
        },
        // Escala de grises oscuros del panel
        ink: {
          950: '#08080A',
          900: '#0E0E11',
          850: '#141418',
          800: '#1A1A1F',
          750: '#212127',
          700: '#2A2A31',
          600: '#3A3A44',
          500: '#4E4E5A',
          400: '#7A7A88',
          300: '#A5A5B2',
          200: '#CFCFD8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Bebas Neue"', 'Impact', 'system-ui', 'sans-serif'],
        // Serif de acento: rompe la monotonia del sans en los titulares
        serif: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(201,162,39,0.35), 0 8px 30px -12px rgba(201,162,39,0.45)',
        panel: '0 10px 40px -20px rgba(0,0,0,0.9)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: 0, transform: 'translateX(24px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        // Cinta de texto que corre sin fin entre secciones
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        // Latido del punto de "abierto ahora"
        'soft-pulse': {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: .55, transform: 'scale(.82)' },
        },
        // Rebote corto de la flecha que invita a bajar
        'nudge-down': {
          '0%, 100%': { transform: 'translateY(0)', opacity: .45 },
          '50%': { transform: 'translateY(7px)', opacity: 1 },
        },
        // Barra de avance del carrusel: se llena de izquierda a derecha
        progress: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        // Entrada del visor de foto a pantalla completa
        'zoom-in': {
          '0%': { opacity: 0, transform: 'scale(.92)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        // Entrada escalonada de las tarjetas de la galeria
        'rise-in': {
          '0%': { opacity: 0, transform: 'translateY(28px) scale(.97)' },
          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out both',
        'slide-up': 'slide-up .3s ease-out both',
        'slide-in-right': 'slide-in-right .25s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        marquee: 'marquee linear infinite',
        'soft-pulse': 'soft-pulse 2.4s ease-in-out infinite',
        'nudge-down': 'nudge-down 2s ease-in-out infinite',
        progress: 'progress linear forwards',
        'zoom-in': 'zoom-in .3s cubic-bezier(.22,1,.36,1) both',
        'rise-in': 'rise-in .55s cubic-bezier(.22,1,.36,1) both',
      },
    },
  },
  plugins: [],
}
