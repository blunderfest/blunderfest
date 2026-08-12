/**
 * Light/dark theme: the user's choice persists in localStorage; unset means
 * follow the OS. The choice lands on `<html data-theme>`, and app.css maps
 * it to the token values. index.html applies it before first paint.
 */
export type Theme = 'light' | 'dark' | 'system';

const KEY = 'blunderfest.theme';

export function getTheme(): Theme {
  const value = localStorage.getItem(KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function applyTheme(): void {
  const theme = getTheme();
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  if (theme === 'system') {
    localStorage.removeItem(KEY);
  } else {
    localStorage.setItem(KEY, theme);
  }
  applyTheme();
}

/** Follow OS theme changes while the user hasn't chosen a side. */
export function watchSystemTheme(): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') {
      applyTheme();
    }
  });
}
