// =============================================================================
// Theme
// =============================================================================
// Color tokens for light and dark themes. All components read from the resolved
// theme object so the overlay works on both light and dark host pages.
// =============================================================================

import { createContext, useContext } from 'react';

export interface ContextualTheme {
  // Panel backgrounds (layered from deepest to surface)
  panelBg: string;
  panelSurface: string;
  panelDeep: string;

  // Borders
  border: string;
  borderSubtle: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Accent (blue)
  accentBg: string;
  accentBorder: string;
  accentText: string;

  // Success
  successText: string;

  // Error
  errorText: string;
  errorBg: string;
  errorBorder: string;

  // Input
  inputBg: string;
  inputBorder: string;
  inputText: string;

  // Mode toggle
  modeToggleBg: string;
  modeButtonInactiveBg: string;
  modeButtonInactiveBorder: string;

  // Shadows
  shadowPanel: string;
  shadowPopup: string;

  // Annotation input (indigo-tinted)
  annotationBg: string;
  annotationHeaderBg: string;
  annotationBorder: string;
  annotationBorderSubtle: string;
  annotationAccentBg: string;
  annotationHandleColor: string;
  annotationInputBg: string;
  annotationInputBorder: string;
  annotationCompletionBg: string;
  annotationHintText: string;
  annotationCodeText: string;
}

export const darkTheme: ContextualTheme = {
  panelBg: '#111827',
  panelSurface: '#0f172a',
  panelDeep: '#0d1321',

  border: 'rgba(148, 163, 184, 0.18)',
  borderSubtle: 'rgba(148, 163, 184, 0.12)',

  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  accentBg: 'rgba(59, 130, 246, 0.28)',
  accentBorder: 'rgba(96, 165, 250, 0.45)',
  accentText: '#93c5fd',

  successText: '#4ade80',

  errorText: '#fca5a5',
  errorBg: 'rgba(127, 29, 29, 0.28)',
  errorBorder: 'rgba(248, 113, 113, 0.18)',

  inputBg: '#111827',
  inputBorder: 'rgba(148, 163, 184, 0.18)',
  inputText: '#e2e8f0',

  modeToggleBg: '#0a0f1a',
  modeButtonInactiveBg: '#1e293b',
  modeButtonInactiveBorder: 'rgba(148, 163, 184, 0.28)',

  shadowPanel: '0 18px 48px rgba(15, 23, 42, 0.45)',
  shadowPopup: '0 4px 16px rgba(0, 0, 0, 0.25)',

  annotationBg: '#1a1a2e',
  annotationHeaderBg: '#131332',
  annotationBorder: 'rgba(99, 102, 241, 0.3)',
  annotationBorderSubtle: 'rgba(99, 102, 241, 0.15)',
  annotationAccentBg: 'rgba(99, 102, 241, 0.8)',
  annotationHandleColor: 'rgba(99, 102, 241, 0.35)',
  annotationInputBg: '#0d0d1a',
  annotationInputBorder: 'rgba(99, 102, 241, 0.2)',
  annotationCompletionBg: '#16162a',
  annotationHintText: '#606078',
  annotationCodeText: '#8fb7ff',
};

export const lightTheme: ContextualTheme = {
  panelBg: '#ffffff',
  panelSurface: '#f8fafc',
  panelDeep: '#f1f5f9',

  border: 'rgba(15, 23, 42, 0.12)',
  borderSubtle: 'rgba(15, 23, 42, 0.08)',

  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',

  accentBg: 'rgba(59, 130, 246, 0.12)',
  accentBorder: 'rgba(59, 130, 246, 0.35)',
  accentText: '#2563eb',

  successText: '#16a34a',

  errorText: '#dc2626',
  errorBg: 'rgba(220, 38, 38, 0.08)',
  errorBorder: 'rgba(220, 38, 38, 0.2)',

  inputBg: '#ffffff',
  inputBorder: 'rgba(15, 23, 42, 0.15)',
  inputText: '#1e293b',

  modeToggleBg: '#e2e8f0',
  modeButtonInactiveBg: '#ffffff',
  modeButtonInactiveBorder: 'rgba(15, 23, 42, 0.18)',

  shadowPanel: '0 18px 48px rgba(15, 23, 42, 0.12)',
  shadowPopup: '0 4px 16px rgba(15, 23, 42, 0.08)',

  annotationBg: '#ffffff',
  annotationHeaderBg: '#f1f5f9',
  annotationBorder: 'rgba(99, 102, 241, 0.25)',
  annotationBorderSubtle: 'rgba(99, 102, 241, 0.12)',
  annotationAccentBg: 'rgba(99, 102, 241, 0.85)',
  annotationHandleColor: 'rgba(99, 102, 241, 0.3)',
  annotationInputBg: '#f8fafc',
  annotationInputBorder: 'rgba(99, 102, 241, 0.2)',
  annotationCompletionBg: '#f1f5f9',
  annotationHintText: '#94a3b8',
  annotationCodeText: '#4f46e5',
};

export const ThemeContext = createContext<ContextualTheme>(darkTheme);

export interface ThemeToggle {
  /** Whether the current theme is dark */
  isDark: boolean;
  /** Toggle between light and dark */
  toggle: () => void;
}

export const ThemeToggleContext = createContext<ThemeToggle>({
  isDark: true,
  toggle: () => {},
});

export function useTheme(): ContextualTheme {
  return useContext(ThemeContext);
}

export function useThemeToggle(): ThemeToggle {
  return useContext(ThemeToggleContext);
}
