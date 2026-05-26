/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FFFBF5',
        apricot: '#FFF5EC',
        blush: '#FFB3B3',
        sunset: '#FFC3A0',
        calm: '#A0C4FF',
        'text-primary': '#4A3F3F',
        'text-secondary': '#9E8F8F',
        mint: '#A8E6CE',
      },
      fontFamily: {
        title: ['"ZCOOL KuaiLe"', 'cursive', 'system-ui', 'sans-serif'],
        body: ['Nunito', '"PingFang SC"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '24px',
        'sm-card': '16px',
        'btn': '12px',
      },
      boxShadow: {
        'soft': '0 4px 20px rgba(74, 63, 63, 0.08)',
        'soft-lg': '0 8px 30px rgba(74, 63, 63, 0.12)',
      },
      maxWidth: {
        'app': '480px',
      },
    },
  },
  plugins: [],
}
