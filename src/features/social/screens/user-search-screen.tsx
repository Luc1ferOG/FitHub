import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { Input } from '@/components/ui';
import { LoadingIndicator } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { useDebouncedSearch, useUserSearch } from '../hooks/use-social';
import { UserCard } from '../components/user-card';
import { SocialListFeedback } from '../components/social-list-feedback';
import { normalizeSearch } from '../services/social-service';

export function UserSearchScreen() {
  const [input, setInput] = useState(''); const search = useDebouncedSearch(input); const query = useUserSearch(search); const router = useRouter(); const theme = useAppTheme();
  const openProfile = useCallback((id: string) => router.push({ pathname: '/user/[id]', params: { id } }), [router]);
  const ready = search.length >= 2 && search.length <= 80; const waiting = normalizeSearch(input) !== search;
  const items = useMemo(() => ready ? query.data?.pages.flatMap((page) => page.items) ?? [] : [], [query.data, ready]);
  const renderItem = useCallback(({ item }: { item: typeof items[number] }) => <UserCard profile={item} onPress={openProfile} />, [openProfile]);
  return <Screen scroll={false} contentStyle={{ flex: 1, gap: 12 }}><Text style={[theme.typography.heading, { color: theme.colors.text }]}>Find people</Text>
    <Input label="Search username or display name" value={input} onChangeText={setInput} maxLength={80} autoCapitalize="none" autoCorrect={false} helperText="Enter at least two characters." />
    {waiting ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted }}>Updating search…</Text> : null}
    <FlatList data={items} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: 12, flexGrow: 1 }}
      renderItem={renderItem}
      ListEmptyComponent={<SocialListFeedback loading={waiting || (ready && query.isPending)} error={ready && !waiting ? query.error : null} title={ready ? 'No people found' : 'Find your friends'} description={ready ? 'Try a different username or display name.' : 'Search by username or display name to connect.'} retry={() => { void query.refetch(); }} />}
      ListFooterComponent={query.isFetchingNextPage ? <LoadingIndicator /> : items.length > 0 && query.isError ? <SocialListFeedback loading={false} error={query.error} title="" description="" retry={() => { void query.fetchNextPage(); }} /> : null}
      onEndReachedThreshold={0.4} onEndReached={() => { if (!waiting && ready && query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage(); }} initialNumToRender={10} maxToRenderPerBatch={8} windowSize={7} />
  </Screen>;
}
