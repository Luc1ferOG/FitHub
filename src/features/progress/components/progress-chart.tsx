import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Card } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { chartGeometry, fieldLabels, formatMeasurement } from '../services/measurement-rules';
import type { ChartPoint, UnitSystem } from '../types/measurement';

type ChartField = 'weightKg' | 'waistCm' | 'bodyFatPercentage';
export const ProgressChart = memo(function ProgressChart({ points, field, units }: { points: ChartPoint[]; field: ChartField; units: UnitSystem }) {
  const theme = useAppTheme(); const [width, setWidth] = useState(0); const [showValues, setShowValues] = useState(false);
  const data = useMemo(() => points.flatMap((point) => { const value = point[field]; return value === null ? [] : [{ date: point.date, value }]; }), [points, field]);
  const geometry = useMemo(() => chartGeometry(data, Math.max(0, width - 12), 130), [data, width]);
  const first = data[0]; const last = data[data.length - 1];
  const min = data.length ? Math.min(...data.map((point) => point.value)) : null;
  const max = data.length ? Math.max(...data.map((point) => point.value)) : null;
  return <Card style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={[theme.typography.heading, { color: theme.colors.text }]}>{fieldLabels[field]} over time</Text>
    {!data.length ? <Text style={{ color: theme.colors.textMuted }}>No {fieldLabels[field].toLowerCase()} entries in this period.</Text> : <>
      <Text style={{ color: theme.colors.textMuted }}>Range {formatMeasurement(min, field, units)} – {formatMeasurement(max, field, units)} · Bucket averages</Text>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} accessible accessibilityRole="image"
        accessibilityLabel={`${fieldLabels[field]} chart. ${data.length} time buckets. First ${formatMeasurement(first?.value ?? null, field, units)} on ${first?.date.slice(0, 10)}, latest ${formatMeasurement(last?.value ?? null, field, units)} on ${last?.date.slice(0, 10)}. Range ${formatMeasurement(min, field, units)} to ${formatMeasurement(max, field, units)}. Use Show chart values for details.`}
        style={{ height: 150, borderBottomWidth: 1, borderColor: theme.colors.border }}>
        {geometry.map((point, index) => {
          const next = geometry[index + 1]; const dx = next ? next.x - point.x : 0; const dy = next ? next.y - point.y : 0; const length = Math.hypot(dx, dy);
          return <View key={data[index]?.date} accessible={false}>
            {next ? <View style={{ position: 'absolute', left: 6 + (point.x + next.x) / 2 - length / 2, top: 8 + (point.y + next.y) / 2, width: length, height: 2, backgroundColor: theme.colors.primary, transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }} /> : null}
            <View style={{ position: 'absolute', left: point.x + 3, top: point.y + 5, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary }} />
          </View>;
        })}
      </View>
      <Text style={{ color: theme.colors.textMuted }}>{first?.date.slice(0, 10)} → {last?.date.slice(0, 10)}</Text>
      <Button variant="ghost" label={showValues ? 'Hide chart values' : 'Show chart values'} accessibilityState={{ expanded: showValues }} onPress={() => setShowValues((value) => !value)} />
      {showValues ? data.map((point) => <Text key={point.date} style={{ color: theme.colors.text }}>{point.date.slice(0, 10)}: {formatMeasurement(point.value, field, units)}</Text>) : null}
    </>}
  </Card>;
});
