/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        swyn: {
          orange: '#F05A28',
          gold: '#C59B27',
          goldLight: '#FAF2DB',
          goldMedium: '#E5C158',
          goldDark: '#866110',
          orangeHover: '#d4491c',
        }
      }
    },
  },
  plugins: [],
}
