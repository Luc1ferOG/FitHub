import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { PublicProfileScreen } from '@/features/social/screens/public-profile-screen';
import { ChallengePushSettings } from '@/features/challenges/components/challenge-push-settings';
import { Screen } from '@/components/layout/screen';
import { Button, Card } from '@/components/ui';
import { FormMessage } from '@/features/auth/components/form-message';
import { useAuth } from '@/features/auth/context/auth-context';
import { useLogoutMutation } from '@/features/auth/hooks/use-auth-mutations';
import { getAuthErrorMessage } from '@/features/auth/services/auth-service';
import { useAppStore } from '@/store/app-store';
import { useAppTheme } from '@/theme';
import type { ThemePreference } from '@/types/navigation';

export function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user } = useAuth();
  const logout = useLogoutMutation();

  return (
    <Screen scroll contentStyle={styles.container}>
      <Card style={styles.card}>
        <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Your profile</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>
          {user?.email ?? 'Profile information, stats, and recent achievements will appear here.'}
        </Text>
        <Button label="Settings" variant="secondary" onPress={() => router.push('/settings')} />
        <Button label="Friends" variant="secondary" onPress={() => router.push('/friends')} />
        <Button label="Achievements" variant="secondary" onPress={() => router.push('/achievements')} />
        {user ? <Button label="View public profile" variant="ghost" onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })} /> : null}
        {logout.error ? <FormMessage message={getAuthErrorMessage(logout.error)} /> : null}
        <Button
          label="Log out"
          loading={logout.isPending}
          variant="ghost"
          onPress={() => logout.mutate()}
        />
      </Card>
    </Screen>
  );
}

export function UserProfileScreen() {
  return <PublicProfileScreen />;
}

export function SettingsScreen() {
  const theme = useAppTheme();
  const preference = useAppStore((state) => state.themePreference);
  const setThemePreference = useAppStore((state) => state.setThemePreference);
  const options: readonly ThemePreference[] = ['system', 'light', 'dark'];

  return (
    <Screen scroll contentStyle={styles.container}>
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Appearance</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>
        Choose how FitHub looks on this device.
      </Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option) => (
          <Button
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: preference === option }}
            label={`${option[0]?.toUpperCase()}${option.slice(1)}`}
            variant={preference === option ? 'primary' : 'secondary'}
            onPress={() => setThemePreference(option)}
          />
        ))}
      </View>
      <ChallengePushSettings />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  card: { gap: 16 },
  options: { gap: 12 },
});
