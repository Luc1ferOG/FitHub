import { useRef, type PropsWithChildren } from 'react';
import { AccessibilityInfo, findNodeHandle, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAccessibilityPreferences } from '@/hooks/use-accessibility-preferences';
import { useAppTheme } from '@/theme';
import { Button } from './button';
export function ModalSurface({ title, children, onClose, busy = false, presentation = 'dialog', scroll = true, closeLabel }: PropsWithChildren<{
  title: string; onClose: () => void; busy?: boolean; presentation?: 'dialog' | 'sheet'; scroll?: boolean; closeLabel?: string;
}>) {
  const theme = useAppTheme(); const { reduceMotion, screenReader } = useAccessibilityPreferences();
  const titleRef = useRef<Text>(null); const translation = useSharedValue(0); const sheet = presentation === 'sheet';
  const busyRef = useRef(busy); busyRef.current = busy;
  const dismiss = () => { if (!busyRef.current) onClose(); };
  const pan = Gesture.Pan().enabled(sheet && !busy && !screenReader).activeOffsetY(12)
    .onUpdate((event) => { translation.value = Math.min(100, Math.max(0, event.translationY)); })
    .onEnd((event) => { if (event.translationY > 80) runOnJS(dismiss)(); })
    .onFinalize(() => { translation.value = withTiming(0, { duration: reduceMotion ? 0 : theme.motion.quick }); });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: translation.value }] }));
  return <Modal visible transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={dismiss}
    onShow={() => { const node = findNodeHandle(titleRef.current); if (node && screenReader) AccessibilityInfo.setAccessibilityFocus(node); }}>
    <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.overlay }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: sheet ? 'flex-end' : 'center', padding: theme.spacing.lg }}>
        <Animated.View accessibilityViewIsModal importantForAccessibility="yes" onAccessibilityEscape={dismiss} style={[{
          width: '100%', maxWidth: theme.layout.modalMaxWidth, alignSelf: 'center', maxHeight: '95%',
          ...(sheet ? { height: '90%' as const } : {}), backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.xl, padding: theme.spacing.lg, gap: theme.spacing.lg,
        }, animated]}>
          {sheet ? <GestureDetector gesture={pan}><View accessible={false} style={{ height: 24, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 40, height: 4, borderRadius: theme.radius.full, backgroundColor: theme.colors.textMuted }} /></View></GestureDetector> : null}
          <Text ref={titleRef} accessibilityRole="header" style={[theme.typography.title, { color: theme.colors.text }]}>{title}</Text>
          {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: theme.spacing.lg }} style={{ flexShrink: 1 }}>{children}</ScrollView> : <View style={{ flex: 1, gap: theme.spacing.md }}>{children}</View>}
          <Button label={closeLabel ?? `Close ${title}`} variant="secondary" disabled={busy} onPress={dismiss} />
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView></GestureHandlerRootView>
  </Modal>;
}
