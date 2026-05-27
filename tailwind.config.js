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
        'card': '24px',
        'sm-card': '16px',
        'btn': '12px',
      },
      boxShadow: {
        'soft': '0 4px 20px var(--shadow-soft)',
        'soft-lg': '0 8px 30px var(--shadow-lg)',
      },
      maxWidth: {
        'app': '480px',
      },
    },
  },
  plugins: [],
}
