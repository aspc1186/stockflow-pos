import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:'#f0f4ff',100:'#dce7ff',200:'#b9cffe',300:'#84a9fc',
          400:'#4d7bf8',500:'#2454f0',600:'#1a3ee6',700:'#152fd4',
          800:'#1628ab',900:'#172787',950:'#111852'
        },
        surface: {
          DEFAULT:'#0f1117',50:'#f8f9fc',100:'#f0f2f8',200:'#e2e6f0',
          800:'#1a1f2e',900:'#0f1117',950:'#080a10'
        }
      },
      animation: {
        'fade-in':'fadeIn 0.2s ease-out',
        'slide-up':'slideUp 0.25s ease-out'
      },
      keyframes: {
        fadeIn:{from:{opacity:'0'},to:{opacity:'1'}},
        slideUp:{from:{opacity:'0',transform:'translateY(8px)'},to:{opacity:'1',transform:'translateY(0)'}}
      }
    }
  },
  plugins: []
}
export default config
