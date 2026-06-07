import { useEffect, useState } from 'react';
import { Moon, Sun } from '@phosphor-icons/react';
import { useThemeStore } from '../stores/theme';

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark';

  // 避免 SSR hydration mismatch:挂载前不渲染图标
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="切换主题"
        className="inline-flex items-center justify-center w-7 h-7 rounded-pill text-ink-muted hover:text-ink-primary hover:bg-ink-primary/[0.06] active:scale-95 transition-all duration-200"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center justify-center w-7 h-7 rounded-pill text-ink-muted hover:text-ink-primary hover:bg-ink-primary/[0.06] active:scale-95 transition-all duration-200"
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      title={isDark ? '浅色' : '深色'}
    >
      {isDark ? (
        <Sun size={14} weight="bold" />
      ) : (
        <Moon size={14} weight="bold" />
      )}
    </button>
  );
}
