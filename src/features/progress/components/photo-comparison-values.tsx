import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Card } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { measurementFields, type UnitSystem } from '../types/measurement';
import type { PhotoComparison } from '../types/progress-photo';
import { comparisonChanges } from '../services/photo-rules';
import { fieldLabels, formatMeasurement } from '../services/measurement-rules';
export function PhotoComparisonValues({ comparison, units }: { comparison: PhotoComparison; units: UnitSystem }) {
  const theme = useAppTheme(); const changes = comparisonChanges(comparison.beforeMeasurements, comparison.afterMeasurements);
  return <Card style={{ gap: 12 }}>
    <Text style={[theme.typography.title, { color: theme.colors.text }]}>Measurement changes</Text>
    <Text style={{ color: theme.colors.textMuted }}>Uses each metric’s latest non-empty reading on the photo’s date. Values are not estimated from images or nearby days.</Text>
    {measurementFields.map((field) => <View key={field} style={{ gap: 4 }}>
      <Text style={{ color: theme.colors.text }}>{fieldLabels[field]} · {changes[field] === null ? 'Not recorded on both dates' : formatMeasurement(changes[field], field, units, true)}</Text>
      <Text style={{ color: theme.colors.textMuted }}>Before {formatMeasurement(comparison.beforeMeasurements?.[field] ?? null, field, units)} · After {formatMeasurement(comparison.afterMeasurements?.[field] ?? null, field, units)}</Text>
    </View>)}
  </Card>;
}
