import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getTheme, THEME_OPTIONS } from '../components/themes/index.js';

const ThemeContext = createContext(null);

/**
 * Theme provider.
 *
 * Two layers:
 *   1. `mode`         — 'light' | 'dark'. Drives the tailwind `dark:` variants
 *                       that the rest of the app already uses. Persisted as
 *                       `sf_theme` so the existing user preference still works.
 *   2. `themeName`    — named visual identity ('light' | 'dark' | 'modern' |
 *                       'analytics' | 'finance'). Drives card/background/
 *                       palette overrides on dashboard surfaces. Persisted
 *                       as `sf_theme_name`.
 *   3. `customPrimary` — optional override hex color from the dashboard
 *                       color picker. Persisted as `sf_theme_primary`.
 *
 * Callers that just want light/dark keep working via `toggle()` and `theme`.
 * Newer callers can read `selected` (the resolved theme object) for fine-
 * grained styling.
 */
export function ThemeProvider({ children }) {
  // Legacy single 'light' / 'dark' toggle.
  const [theme, setTheme] = useState(() => localStorage.getItem('sf_theme') || 'light');
  // New: named visual theme. Defaults to whichever mode is active.
  const [themeName, setThemeName] = useState(() =>
    localStorage.getItem('sf_theme_name') || (localStorage.getItem('sf_theme') === 'dark' ? 'dark' : 'light'),
  );
  const [customPrimary, setCustomPrimary] = useState(() => localStorage.getItem('sf_theme_primary') || '');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('sf_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sf_theme_name', themeName);
    const resolved = getTheme(themeName);
    // Mirror the named theme's mode into the light/dark toggle so the
    // existing tailwind dark: variants pick up the new palette.
    if (resolved.mode && resolved.mode !== theme) setTheme(resolved.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeName]);

  useEffect(() => {
    if (customPrimary) localStorage.setItem('sf_theme_primary', customPrimary);
    else localStorage.removeItem('sf_theme_primary');
  }, [customPrimary]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const selected = useMemo(() => {
    const base = getTheme(themeName);
    return customPrimary ? { ...base, primary: customPrimary } : base;
  }, [themeName, customPrimary]);

  return (
    <ThemeContext.Provider
      value={{
        theme, setTheme, toggle,
        themeName, setThemeName,
        customPrimary, setCustomPrimary,
        selected,
        options: THEME_OPTIONS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
