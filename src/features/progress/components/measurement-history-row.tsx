import { memo } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Card } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { measurementFields, type Measurement, type UnitSystem } from '../types/measurement';
import { fieldLabels, formatMeasurement } from '../services/measurement-rules';
export const MeasurementHistoryRow = memo(function MeasurementHistoryRow({ entry, units, deleting, onEdit, onDelete }: {
  entry: Measurement; units: UnitSystem; deleting: boolean; onEdit: (id: string) => void; onDelete: (entry: Measurement) => void;
}) {
  const theme = useAppTheme();
  return <Card style={{ gap: 12, marginBottom: 12 }}>
    <Text accessibilityRole="header" style={[theme.typography.title, { color: theme.colors.text }]}>{entry.recordedAt.slice(0, 10)}</Text>
    {measurementFields.filter((field) => entry[field] !== null).map((field) => <Text key={field} style={{ color: theme.colors.text }}>{fieldLabels[field]}: {formatMeasurement(entry[field], field, units)}</Text>)}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button variant="secondary" label="Edit" accessibilityLabel={`Edit measurement from ${entry.recordedAt.slice(0, 10)}`} disabled={deleting} onPress={() => onEdit(entry.id)} />
      <Button variant="danger" label="Delete" accessibilityLabel={`Delete measurement from ${entry.recordedAt.slice(0, 10)}`} disabled={deleting} onPress={() => onDelete(entry)} />
    </View>
  </Card>;
});
