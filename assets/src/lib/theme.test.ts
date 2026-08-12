import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, getTheme, setTheme } from '@/lib/theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('defaults to system and follows the OS (light in tests)', () => {
    expect(getTheme()).toBe('system');
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists an explicit choice and applies it', () => {
    setTheme('dark');
    expect(localStorage.getItem('blunderfest.theme')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    setTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('returns to the OS when reset to system', () => {
    setTheme('dark');
    setTheme('system');
    expect(localStorage.getItem('blunderfest.theme')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
