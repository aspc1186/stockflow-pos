/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',900:'#312e81' },
        surface: { 50:'#f8fafc',100:'#e2e8f0',200:'#cbd5e1',700:'#334155',800:'#1e293b',900:'#0f172a',950:'#020617' }
      }
    }
  },
  plugins: []
}
