import { View } from 'react-native';
import { useAppTheme } from '@/theme';
export function Separator() {
  const theme = useAppTheme();
  return <View accessible={false} style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.md }} />;
}
