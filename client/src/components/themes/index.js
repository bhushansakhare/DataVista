// Theme registry — one named object per visual identity. Each theme
// exposes the same keys so consumers can stay agnostic. The "mode"
// dictates whether the existing tailwind `dark:` variants kick in.
import { light } from './lightTheme.js';
import { dark } from './darkTheme.js';
import { modern } from './modernTheme.js';
import { analytics } from './analyticsTheme.js';
import { finance } from './financeTheme.js';

export const THEMES = { light, dark, modern, analytics, finance };

export function getTheme(name) {
  return THEMES[name] || THEMES.light;
}

export const THEME_OPTIONS = [
  { key: 'light',     label: 'Light',     description: 'Clean, neutral, daylight' },
  { key: 'dark',      label: 'Dark',      description: 'Inky, focused, low-glare' },
  { key: 'modern',    label: 'Modern',    description: 'Brand gradient, soft glass' },
  { key: 'analytics', label: 'Analytics', description: 'Data-dense, high contrast' },
  { key: 'finance',   label: 'Finance',   description: 'Cool greens / serif accents' },
];
