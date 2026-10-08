import { AppText as Text } from '@/components/ui/app-text';
import { Button, ModalSurface } from '@/components/ui';
import { useAppTheme } from '@/theme';

export function DeleteWorkoutDialog({ name, busy, error, onConfirm, onCancel }: { name: string; busy: boolean; error: string | null; onConfirm: () => void; onCancel: () => void }) {
  const theme = useAppTheme();
  return <ModalSurface title={`Delete ${name}?`} busy={busy} onClose={onCancel} closeLabel="Cancel deletion">
        <Text style={[theme.typography.body, { color: theme.colors.text }]}>This permanently deletes the template. Completed workout history is kept.</Text>
        {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text> : null}
        <Button label="Delete workout permanently" variant="danger" loading={busy} disabled={busy} onPress={onConfirm} />
  </ModalSurface>;
}
