export const THEME_COOKIE = 'astroid-theme';

export type ThemeMode = 'light' | 'dark' | 'system';

export function readThemeCookie(rawValue?: string | null): ThemeMode {
  if (rawValue === 'dark' || rawValue === 'light' || rawValue === 'system') {
    return rawValue;
  }
  return 'light';
}

export function resolveThemeValue(mode: ThemeMode): 'light' | 'dark' {
  if (typeof window !== 'undefined' && mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode === 'dark' ? 'dark' : 'light';
}

export function getDocumentThemeCookie(): ThemeMode {
  if (typeof document === 'undefined') {
    return 'light';
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${encodeURIComponent(THEME_COOKIE)}=([^;]*)`),
  );
  const cookieValue = match?.[1];
  const value = cookieValue ? decodeURIComponent(cookieValue) : null;
  return readThemeCookie(value);
}

export function setThemeCookie(mode: ThemeMode) {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(THEME_COOKIE)}=${encodeURIComponent(mode)}; Path=/; SameSite=Lax${secure}; Max-Age=31536000`;
}
