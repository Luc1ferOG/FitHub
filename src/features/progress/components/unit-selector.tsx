import { View } from 'react-native';
import { Button } from '@/components/ui';
import type { UnitSystem } from '../types/measurement';
export function UnitSelector({ units, onChange, disabled = false }: { units: UnitSystem; onChange: (units: UnitSystem) => void; disabled?: boolean }) {
  return <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
    {(['metric', 'imperial'] as const).map((value) => <Button key={value} label={value === 'metric' ? 'Metric · kg / cm' : 'Imperial · lb / in'}
      accessibilityState={{ selected: value === units, disabled }} disabled={disabled} variant={units === value ? 'primary' : 'secondary'} onPress={() => onChange(value)} />)}
  </View>;
}
