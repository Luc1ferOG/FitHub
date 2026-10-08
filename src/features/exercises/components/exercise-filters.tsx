import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { useAppTheme } from '@/theme';

import type { ExerciseDifficulty, ExerciseFilterOptions, ExerciseFilters } from '../types/exercise';

type FilterField = 'muscle' | 'equipment' | 'difficulty';
export type ExerciseFilterChange = (field: FilterField, value: string | null) => void;

const DIFFICULTIES: readonly ExerciseDifficulty[] = ['beginner', 'intermediate', 'advanced'];

export const ExerciseFiltersPanel = memo(function ExerciseFiltersPanel({ filters, options, onChange }: {
  filters: ExerciseFilters;
  options: ExerciseFilterOptions | undefined;
  onChange: ExerciseFilterChange;
}) {
  return (
    <View style={styles.groups}>
      <FilterRow label="Muscle" field="muscle" options={options?.muscles ?? []} value={filters.muscle} onChange={onChange} />
      <FilterRow label="Equipment" field="equipment" options={options?.equipment ?? []} value={filters.equipment} onChange={onChange} />
      <FilterRow label="Difficulty" field="difficulty" options={DIFFICULTIES} value={filters.difficulty} onChange={onChange} />
    </View>
  );
});

function FilterRow({ label, field, options, value, onChange }: {
  label: string; field: FilterField; options: readonly string[]; value: string | null; onChange: ExerciseFilterChange;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.group}>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {[null, ...options].map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option ?? 'all'}
              accessibilityRole="button"
              accessibilityLabel={option ? `${label}: ${option}` : `All ${label.toLowerCase()}`}
              accessibilityState={{ selected }}
              onPress={() => onChange(field, option)}
              style={[styles.chip, {
                backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
              }]}
            >
              <Text style={[theme.typography.caption, { color: selected ? theme.colors.primaryContrast : theme.colors.text }]}>
                {option ?? 'All'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: 8 },
  group: { gap: 2 },
  options: { gap: 8 },
  chip: { minHeight: 48, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
});
