import { ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { useAppStore } from '@/store/app-store';

import { darkTheme, lightTheme, type AppTheme } from './themes';

const ThemeContext = createContext<AppTheme | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const preference = useAppStore((state) => state.themePreference);
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
    return () => Appearance.setColorScheme('unspecified');
  }, [preference]);

  const theme = useMemo(() => {
    const resolvedScheme = preference === 'system' ? systemColorScheme : preference;
    return resolvedScheme === 'dark' ? darkTheme : lightTheme;
  }, [preference, systemColorScheme]);

  return (
    <ThemeContext.Provider value={theme}>
      <NavigationThemeProvider value={theme.navigation}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        {children}
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): AppTheme {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }

  return theme;
}
