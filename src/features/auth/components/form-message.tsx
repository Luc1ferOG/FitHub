import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { useAppTheme } from '@/theme';

type FormMessageProps = {
  message: string;
  tone?: 'error' | 'success';
};

export function FormMessage({ message, tone = 'error' }: FormMessageProps) {
  const theme = useAppTheme();

  return (
    <View accessibilityLiveRegion="polite" accessibilityRole={tone === 'error' ? 'alert' : 'summary'}>
      <Text
        style={[
          theme.typography.caption,
          { color: tone === 'error' ? theme.colors.danger : theme.colors.success },
        ]}
      >
        {message}
      </Text>
    </View>
  );
}
