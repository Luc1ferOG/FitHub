import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { useAccessibilityPreferences } from '@/hooks/use-accessibility-preferences';

type Item = { id: string; exerciseName: string };
type Props = { items: readonly Item[]; selectedId: string | null; disabled: boolean;
  onSelect: (id: string) => void; onMove: (from: number, to: number) => void; onDrag: (active: boolean) => void };

export function ReorderExercises({ items, ...props }: Props) {
  return <View>{items.map((item, index) => <DragRow key={item.id} item={item} index={index} count={items.length} {...props} />)}</View>;
}
const DragRow = memo(function DragRow({ item, index, count, selectedId, disabled, onSelect, onMove, onDrag }: Omit<Props, 'items'> & { item: Item; index: number; count: number }) {
  const theme = useAppTheme();
  const { fontScale, compact } = useResponsiveLayout();
  const { reduceMotion, screenReader } = useAccessibilityPreferences();
  const rowHeight = Math.ceil((compact ? 120 : 80) * Math.max(1, fontScale));
  const translation = useSharedValue(0);
  const active = useSharedValue(false);
  const gesture = Gesture.Pan().enabled(!disabled && !screenReader).activateAfterLongPress(200)
    .onStart(() => { active.value = true; runOnJS(onDrag)(true); })
    .onUpdate((event) => { translation.value = Math.max(-index * rowHeight, Math.min((count - index - 1) * rowHeight, event.translationY)); })
    .onEnd(() => {
      const target = Math.max(0, Math.min(count - 1, index + Math.round(translation.value / rowHeight)));
      translation.value = 0;
      runOnJS(onMove)(index, target);
    })
    .onFinalize(() => { translation.value = reduceMotion ? 0 : withSpring(0); active.value = false; runOnJS(onDrag)(false); });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translation.value }], zIndex: active.value ? 10 : 0, elevation: active.value ? 8 : 0, opacity: active.value ? 0.85 : 1 }));
  return <Animated.View style={[{ height: rowHeight, paddingBottom: 8 }, animatedStyle]}>
    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: selectedId === item.id ? theme.colors.primary : theme.colors.border }}>
      <GestureDetector gesture={gesture}><View accessible accessibilityLabel={`Drag handle for ${item.exerciseName}`} accessibilityHint="Hold briefly and drag vertically to reorder. Move buttons are also available." style={{ width: 48, minHeight: 64, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.colors.text }}>↕</Text></View></GestureDetector>
      <Pressable accessibilityRole="button" accessibilityLabel={`Configure exercise ${index + 1}: ${item.exerciseName}`} accessibilityState={{ selected: selectedId === item.id, disabled }} disabled={disabled} onPress={() => onSelect(item.id)} style={{ flex: 1, minWidth: compact ? '70%' : 0, minHeight: 48, justifyContent: 'center' }}>
        <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>{index + 1}. {item.exerciseName}</Text>
      </Pressable>
      <Button label="↑" accessibilityLabel={`Move ${item.exerciseName} up`} variant="ghost" disabled={disabled || index === 0} onPress={() => onMove(index, index - 1)} style={{ paddingHorizontal: 8 }} />
      <Button label="↓" accessibilityLabel={`Move ${item.exerciseName} down`} variant="ghost" disabled={disabled || index === count - 1} onPress={() => onMove(index, index + 1)} style={{ paddingHorizontal: 8 }} />
    </View>
  </Animated.View>;
});
