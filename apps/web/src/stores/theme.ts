import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'safety-edu-theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  // jsdom 等环境可能没有 matchMedia — 防御一下
  if (typeof window.matchMedia !== 'function') return 'light';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

/**
 * 单一 theme 状态源,供 Toaster / ThemeToggle 等组件共享。
 * - 用 zustand,避免 prop drilling
 * - 写入时同步给 localStorage 和 <html> 的 .dark class
 * - SSR 安全:window/document 访问用 typeof 守卫
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (t) => {
    set({ theme: t });
    applyTheme(t);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, t);
    }
  },
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

// 启动时同步一次 (ThemeToggle 挂载前,Toaster 第一次渲染时 class 已正确)
if (typeof window !== 'undefined') {
  applyTheme(useThemeStore.getState().theme);
}
