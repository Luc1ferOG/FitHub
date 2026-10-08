import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/ui/app-text';

import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui';
import { useAppTheme } from '@/theme';

type AuthScreenLayoutProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  footer?: ReactNode;
}>;

export function AuthScreenLayout({ title, subtitle, footer, children }: AuthScreenLayoutProps) {
  const theme = useAppTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Screen scroll contentStyle={styles.screen}>
        <View style={styles.brand} accessibilityRole="header">
          <View style={[styles.mark, { backgroundColor: theme.colors.primary }]}>
            <Text style={[theme.typography.title, { color: theme.colors.primaryContrast }]}>FH</Text>
          </View>
          <Text style={[theme.typography.display, styles.center, { color: theme.colors.text }]}>
            {title}
          </Text>
          <Text style={[theme.typography.body, styles.center, { color: theme.colors.textMuted }]}>
            {subtitle}
          </Text>
        </View>
        <Card style={styles.form}>{children}</Card>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { justifyContent: 'center', gap: 24, paddingVertical: 32 },
  brand: { alignItems: 'center', gap: 8 },
  mark: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
  form: { gap: 16 },
  footer: { alignItems: 'center' },
});
