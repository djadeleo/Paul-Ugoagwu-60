import type { Config } from 'tailwindcss';
import { siteConfig as c } from './site.config';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: { DEFAULT: c.theme.bg, soft: c.theme.bgSoft, card: c.theme.card },
        platinum: { DEFAULT: c.theme.platinum, dim: c.theme.platinumDim },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
