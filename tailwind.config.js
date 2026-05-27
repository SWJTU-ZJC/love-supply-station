/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: 'var(--color-bg)',
        apricot: 'var(--color-bg-soft)',
        blush: 'var(--color-primary)',
        sunset: 'var(--color-accent)',
        calm: 'var(--color-blue)',
        'text-primary': 'var(--color-text)',
        'text-secondary': 'var(--color-text-soft)',
        mint: 'var(--color-green)',
      },
      fontFamily: {
        title: ['"ZCOOL KuaiLe"', 'cursive', 'system-ui', 'sans-serif'],
        body: ['Nunito', '"PingFang SC"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': 'var(--radius-card)',
        'sm-card': 'var(--radius-sm-card)',
        'btn': 'var(--radius-btn)',
      },
      boxShadow: {
        'soft': 'var(--shadow-card)',
        'soft-lg': 'var(--shadow-card-lg)',
      },
      maxWidth: {
        'app': '480px',
      },
    },
  },
  plugins: [],
}
