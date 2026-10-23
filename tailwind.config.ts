import type { Config } from 'tailwindcss'

// Tokens from the RemitPulse Figma design system (14 · Design system & interaction states).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0A192F',
        royal: { DEFAULT: '#2563EB', hover: '#1D4ED8', soft: '#EFF6FF' },
        mint: { DEFAULT: '#10B981', soft: '#ECFDF5', dark: '#047857' },
        ink: '#1E293B',
        muted: '#64748B',
        border: '#E2E8F0',
        surface: '#F8FAFC',
        danger: { DEFAULT: '#DC2626', soft: '#FEF2F2' },
        warn: { DEFAULT: '#B45309', soft: '#FFFBEB' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        caption: ['11px', '1.45'],
        label: ['12px', { lineHeight: '1.45', fontWeight: '600' }],
        body: ['14px', '1.45'],
      },
      borderRadius: { card: '16px', control: '12px' },
      height: { action: '52px' },
      maxWidth: { flow: '480px' },
      width: { sidebar: '232px' },
    },
  },
  plugins: [],
}

export default config
