import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 用 CSS variables 驱动,自动支持 .dark 模式
        // 全部走 rgb(var(--xxx) / <alpha-value>) 以便 bg-ink-secondary/[0.5] 等 alpha 修饰符能编译
        bg: {
          base: 'rgb(var(--bg-base) / <alpha-value>)',
          surface: 'rgb(var(--bg-surface) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
          sunken: 'rgb(var(--bg-sunken) / <alpha-value>)',
        },
        ink: {
          primary: 'rgb(var(--ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          ghost: 'rgb(var(--ink-ghost) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          subtle: 'rgb(var(--line-subtle) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        accent: {
          // DEFAULT 是 ink-primary 别名(不动)
          DEFAULT: 'var(--ink-primary)',
          'pale-red': {
            bg: 'rgb(var(--accent-pale-red-bg) / <alpha-value>)',
            fg: 'rgb(var(--accent-pale-red-fg) / <alpha-value>)',
          },
          'pale-blue': {
            bg: 'rgb(var(--accent-pale-blue-bg) / <alpha-value>)',
            fg: 'rgb(var(--accent-pale-blue-fg) / <alpha-value>)',
          },
          'pale-green': {
            bg: 'rgb(var(--accent-pale-green-bg) / <alpha-value>)',
            fg: 'rgb(var(--accent-pale-green-fg) / <alpha-value>)',
          },
          'pale-yellow': {
            bg: 'rgb(var(--accent-pale-yellow-bg) / <alpha-value>)',
            fg: 'rgb(var(--accent-pale-yellow-fg) / <alpha-value>)',
          },
          'pale-violet': {
            bg: 'rgb(var(--accent-pale-violet-bg) / <alpha-value>)',
            fg: 'rgb(var(--accent-pale-violet-fg) / <alpha-value>)',
          },
        },
        brand: {
          DEFAULT: 'var(--brand)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          tint: 'rgb(var(--brand-tint) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'Geist Variable',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans SC',
          'sans-serif',
        ],
        serif: [
          'Newsreader Variable',
          'Newsreader',
          'Lyon Text',
          'Playfair Display',
          'Georgia',
          'serif',
        ],
        mono: [
          'Geist Mono Variable',
          'SF Mono',
          'JetBrains Mono',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        'serif-display': [
          'clamp(2.75rem, 6vw, 5.5rem)',
          {
            lineHeight: '1.05',
            letterSpacing: '-0.035em',
            fontWeight: '400',
            fontFamily: 'Newsreader Variable, Newsreader, Georgia, serif',
          },
        ],
        'serif-headline': [
          'clamp(1.75rem, 3.5vw, 2.5rem)',
          {
            lineHeight: '1.15',
            letterSpacing: '-0.025em',
            fontWeight: '400',
            fontFamily: 'Newsreader Variable, Newsreader, Georgia, serif',
          },
        ],
        body: ['0.9375rem', { lineHeight: '1.6' }],
      },
      borderRadius: {
        // editorial 风格:小圆角,不用 rounded-full
        card: '12px',
        btn: '6px',
        pill: '9999px',
      },
      boxShadow: {
        // 几乎无 shadow,hover 时超淡 — 走 CSS 变量跟随主题
        none: 'none',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 2.2s linear infinite',
        'ambient-drift': 'ambientDrift 24s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        ambientDrift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(8%, -4%) scale(1.1)' },
          '66%': { transform: 'translate(-6%, 6%) scale(0.95)' },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
