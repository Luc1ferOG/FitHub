import { createContext, createElement, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo } from 'react-native';
const PreferencesContext = createContext({ reduceMotion: true, screenReader: true });
export function AccessibilityPreferencesProvider({ children }: PropsWithChildren) {
  // Conservative until native preferences resolve: never briefly animate for a
  // user whose reduced-motion setting is enabled.
  const [reduceMotion, setReduceMotion] = useState(true);
  const [screenReader, setScreenReader] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); }).catch(() => undefined);
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => { if (active) setScreenReader(value); }).catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { active = false; motion.remove(); reader.remove(); };
  }, []);
  return createElement(PreferencesContext.Provider, { value: { reduceMotion, screenReader } }, children);
}
export function useAccessibilityPreferences() { return useContext(PreferencesContext); }
