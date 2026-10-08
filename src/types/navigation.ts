export type ThemePreference = 'light' | 'dark' | 'system';

export type DeepLinkTarget =
  | { type: 'challenge'; id: string }
  | { type: 'workout'; id: string }
  | { type: 'user'; id: string };
