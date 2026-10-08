import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme';
import type { PublicUser } from '../types/social';

export const UserCard = memo(function UserCard({ profile, onPress }: { profile: PublicUser; onPress: (id: string) => void }) {
  const theme = useAppTheme();
  return <Pressable onPress={() => onPress(profile.id)} accessibilityRole="button" accessibilityLabel={`View ${profile.displayName}, @${profile.username}'s public profile`}
    accessibilityHint="Opens profile and friend actions" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 72, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border }}>
    {profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} enforceEarlyResizing recyclingKey={profile.id} cachePolicy="memory-disk" contentFit="cover" accessibilityIgnoresInvertColors style={{ width: 48, height: 48, borderRadius: 24 }} />
      : <View accessible={false} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surfaceMuted, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: theme.colors.text }}>{profile.displayName.slice(0, 1).toUpperCase()}</Text></View>}
    <View style={{ flex: 1, minWidth: 0 }}><Text style={[theme.typography.title, { color: theme.colors.text }]}>{profile.displayName}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>@{profile.username} · {profile.experienceLevel}</Text></View>
  </Pressable>;
});
