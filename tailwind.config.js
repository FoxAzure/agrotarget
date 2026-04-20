/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agro: {
          green: '#116534',   // Seu verde predominante
          orange: '#F6821F',  // O laranja para os detalhes provocativos
          accent: '#1a8a47',  // Um verde médio para variações
        }
      },
    },
  },
  plugins: [],
}