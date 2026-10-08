import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Card } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { measurementFields, type ProgressDashboard, type UnitSystem } from '../types/measurement';
import { fieldLabels, formatMeasurement, summaryChanges } from '../services/measurement-rules';
export function MeasurementSummary({ dashboard, units }: { dashboard: ProgressDashboard; units: UnitSystem }) {
  const theme = useAppTheme(); const weight = dashboard.summaries.weightKg; const changes = summaryChanges(weight);
  return <View style={{ gap: 16 }}>
    <Card style={{ gap: 8 }}>
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Latest weight · {formatMeasurement(weight.latest, 'weightKg', units)}</Text>
      <Text style={{ color: theme.colors.textMuted }}>{weight.recordedAt ? `Recorded ${weight.recordedAt.slice(0, 10)}` : 'No weight recorded yet'}</Text>
      <Text style={{ color: theme.colors.text }}>From previous: {formatMeasurement(changes.previous, 'weightKg', units, true)}</Text>
      <Text style={{ color: theme.colors.text }}>From starting: {formatMeasurement(changes.starting, 'weightKg', units, true)}</Text>
    </Card>
    <Card style={{ gap: 12 }}>
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Body measurement changes</Text>
      <Text style={{ color: theme.colors.textMuted }}>All-history comparisons. Blank measurements are skipped; changes are not judged as good or bad.</Text>
      {measurementFields.filter((field) => field !== 'weightKg').map((field) => {
        const summary = dashboard.summaries[field]; const change = summaryChanges(summary);
        return <View key={field} accessible accessibilityLabel={`${fieldLabels[field]}, latest ${formatMeasurement(summary.latest, field, units)}, change from previous ${formatMeasurement(change.previous, field, units, true)}, change from starting ${formatMeasurement(change.starting, field, units, true)}`} style={{ gap: 4 }}>
          <Text style={{ color: theme.colors.text }}>{fieldLabels[field]} · {formatMeasurement(summary.latest, field, units)}</Text>
          <Text style={{ color: theme.colors.textMuted }}>Previous {formatMeasurement(change.previous, field, units, true)} · Starting {formatMeasurement(change.starting, field, units, true)}</Text>
        </View>;
      })}
    </Card>
  </View>;
}
