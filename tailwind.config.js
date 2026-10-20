/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', 'sans-serif'],
      },
      colors: {
        paper: '#F3EEE4',
        card: '#FFFDF8',
        ink: '#1C1917',
        mute: '#3F3830',
        pine: '#14532D',
        help: '#6B3A0A',
        helpbg: '#F4E4C4',
        bad: '#7F1D1D',
        wash: '#E4EFE6',
      },
      boxShadow: {
        card: '0 18px 40px -28px rgba(70, 48, 20, 0.45)',
      },
    },
  },
  plugins: [],
}
