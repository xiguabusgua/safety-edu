/// <reference types="vitest" />
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../stores/theme';

describe('useThemeStore', () => {
  beforeEach(() => {
    // 重置为已知状态
    localStorage.removeItem('safety-edu-theme');
    document.documentElement.classList.remove('dark');
    useThemeStore.setState({ theme: 'light' });
  });

  it('starts with light theme when storage empty', () => {
    // 单独重置后,store 默认 light
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('toggle flips theme and applies dark class', () => {
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setTheme persists to localStorage', () => {
    useThemeStore.getState().setTheme('dark');
    expect(localStorage.getItem('safety-edu-theme')).toBe('dark');

    useThemeStore.getState().setTheme('light');
    expect(localStorage.getItem('safety-edu-theme')).toBe('light');
  });

  it('reactive subscribe updates when theme changes', () => {
    const states: string[] = [];
    const unsub = useThemeStore.subscribe((s) => states.push(s.theme));
    useThemeStore.getState().toggle();
    useThemeStore.getState().toggle();
    unsub();
    expect(states).toEqual(['dark', 'light']);
  });
});
