import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0e17',
        foreground: '#e8eaed',
        primary: '#3b9eff',
        'primary-dim': '#3b9eff20',
        'muted-foreground': '#6b7280',
        secondary: '#111827',
        'secondary-hover': '#1a2332',
        border: '#1f2937',
        'border-bright': '#374151',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config
