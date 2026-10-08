import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const modules = new Map();
function stub(exports) { return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }); }
let receive, lastResponse = null, clears = 0, removed = 0, granted = true, handler;
const scheduled = [], categories = [], captures = [], channels = [];
const platform = { OS: 'android' }, appState = { currentState: 'active' };
const notifications = stub({
  DEFAULT_ACTION_IDENTIFIER: 'default', AndroidImportance: { DEFAULT: 3, HIGH: 4 }, SchedulableTriggerInputTypes: { DATE: 'date' },
  addNotificationResponseReceivedListener: (callback) => { receive = callback; return { remove: () => { removed++; } }; },
  getLastNotificationResponseAsync: async () => lastResponse,
  clearLastNotificationResponseAsync: async () => { clears++; },
  setNotificationHandler: (value) => { handler = value; },
  setNotificationCategoryAsync: async (category) => { categories.push(category); },
  setNotificationChannelAsync: async (id) => { channels.push(id); },
  getPermissionsAsync: async () => ({ granted }),
  scheduleNotificationAsync: async (request) => { scheduled.push(request); return 'local-id'; },
});
const native = stub({ Platform: platform, AppState: appState });
const intentStore = stub({ useNavigationIntentStore: { getState: () => ({ capture: (path) => captures.push(path) }) } });
function source(path) {
  if (!modules.has(path)) modules.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }), { identifier: path }));
  return modules.get(path);
}
async function load(path) {
  const module = source(path);
  if (module.status === 'unlinked') await module.link((specifier, parent) => {
    if (specifier === 'expo-notifications') return notifications;
    if (specifier === 'react-native') return native;
    if (specifier === '@/store/navigation-intent-store') return intentStore;
    return source(specifier.startsWith('@/') ? `src/${specifier.slice(2)}.ts` : `${posix.normalize(posix.join(posix.dirname(parent.identifier), specifier))}.ts`);
  });
  if (module.status !== 'evaluated') await module.evaluate(); return module.namespace;
}
const { parseDestination, notificationTarget } = await load('src/services/navigation/destinations.ts');
const { intendedDestination, parseStoredIntent } = await load('src/services/navigation/navigation-intent.ts');
const { resolveAuthRoute } = await load('src/features/auth/services/auth-route-guard.ts');
const { redirectSystemPath } = await load('src/app/+native-intent.ts');
const { listenForNotificationResponses } = await load('src/services/notifications/notification-response-listener.ts');
const { NotificationService } = await load('src/services/notifications/notification-service.ts');
const { notificationCategory } = await load('supabase/functions/_shared/notification-category.ts');
const ID = '10000000-0000-0000-0000-000000000001', OWNER = '20000000-0000-0000-0000-000000000001';

for (const [root, expected] of [['challenge', 'challenges'], ['workout', 'workouts'], ['user', 'user']]) {
  test(`${root} custom link normalizes to the supported destination`, () => {
    assert.equal(parseDestination(`fithub://${root}/${ID}`), `/${expected}/${ID}`);
    assert.equal(parseDestination(`fithub:///${root}/${ID}`), `/${expected}/${ID}`);
  });
}
for (const unsafe of ['https://evil.example/challenge/123', 'javascript:alert(1)', '//evil.example/path', 'fithub://user@challenge/123', 'fithub://challenge/../user/123', 'fithub://challenge/%2fsettings', 'fithub://challenge/123?redirect=https://evil.example', '/challenges/a#fragment', '/challenges/a\\b', '/challenges/one/two']) {
  test(`rejects unsafe or ambiguous route ${unsafe}`, () => assert.equal(parseDestination(unsafe), null));
}
test('safe invalid abc identifier survives authentication without authorizing a database query', () => {
  const path = parseDestination('fithub://challenge/abc'); assert.equal(path, '/challenges/abc');
  const pending = parseStoredIntent({ path, recipientId: null, createdAt: 1000 }, 1000);
  assert.equal(intendedDestination(pending, null, 1000), null);
  assert.deepEqual(resolveAuthRoute({ isInitializing: false, isAuthenticated: false, firstSegment: 'challenges', intendedRoute: path }), { type: 'redirect', href: '/(auth)/login' });
  assert.deepEqual(resolveAuthRoute({ isInitializing: false, isAuthenticated: true, firstSegment: '(auth)', intendedRoute: path }), { type: 'redirect', href: '/challenges/abc' });
  assert.match(readFileSync('src/features/leaderboards/screens/leaderboard-screen.tsx', 'utf8'), /!isUuid\(scope.challengeId\)/);
});
test('auth restoration blocks navigation; normal login still goes home; recovery remains accessible', () => {
  assert.deepEqual(resolveAuthRoute({ isInitializing: true, isAuthenticated: false, firstSegment: 'challenges', intendedRoute: `/challenges/${ID}` }), { type: 'loading' });
  assert.deepEqual(resolveAuthRoute({ isInitializing: false, isAuthenticated: true, firstSegment: '(auth)' }), { type: 'redirect', href: '/(tabs)/home' });
  assert.deepEqual(resolveAuthRoute({ isInitializing: false, isAuthenticated: true, firstSegment: 'reset-password', intendedRoute: `/challenges/${ID}` }), { type: 'allow' });
  assert.deepEqual(resolveAuthRoute({ isInitializing: false, isAuthenticated: true, firstSegment: '(auth)', intendedRoute: 'https://evil.example' }), { type: 'redirect', href: '/(tabs)/home' });
});
test('stored destinations expire and are isolated to notification recipients', () => {
  const intent = { path: `/challenges/${ID}`, recipientId: OWNER, createdAt: 1000 };
  assert.equal(intendedDestination(intent, OWNER, 2000), intent.path);
  assert.equal(intendedDestination(intent, ID, 2000), null);
  assert.equal(parseStoredIntent(intent, 1000 + 86400001), null);
  assert.equal(parseStoredIntent(intent, 999), null);
  assert.equal(parseStoredIntent({ ...intent, recipientId: 'abc' }, 2000), null);
  assert.equal(parseStoredIntent({ ...intent, path: 'https://evil.example' }, 2000), null);
});
for (const [kind, fields, path] of [
  ['friend_request', {}, '/friends/requests'], ['achievement_unlocked', {}, '/achievements'],
  ['invite', { challengeId: ID }, `/challenges/${ID}`], ['ending_soon', { challengeId: ID }, `/challenges/${ID}`],
  ['challenge_invite', { challengeId: ID }, `/challenges/${ID}`], ['challenge_ending_soon', { challengeId: ID }, `/challenges/${ID}`],
  ['workout-rest', { sessionId: ID }, `/workouts/active/${ID}`],
]) test(`notification ${kind} maps to its validated recipient-scoped destination`, () => {
  assert.deepEqual(notificationTarget({ kind, userId: OWNER, ...fields }), { path, recipientId: OWNER });
});
test('notification payloads reject invalid IDs, missing recipients and injected URLs', () => {
  for (const data of [null, [], { kind: { toString: 'not-a-function' }, userId: OWNER }, { kind: 'invite', userId: OWNER, challengeId: 'abc' }, { kind: 'friend_request' }, { kind: 'unknown', userId: OWNER, url: 'https://evil.example' }]) assert.equal(notificationTarget(data), null);
});
test('native intent stores canonical destination but preserves unstored PKCE recovery parameters', () => {
  captures.length = 0;
  assert.equal(redirectSystemPath({ path: `fithub://challenge/${ID}`, initial: true }), `/challenges/${ID}`);
  assert.deepEqual(captures, [`/challenges/${ID}`]);
  assert.equal(redirectSystemPath({ path: 'fithub://reset-password?code=secret', initial: true }), '/reset-password?code=secret');
  assert.equal(captures.length, 1);
  assert.equal(redirectSystemPath({ path: 'fithub://challenge/%ZZ', initial: false }), '/link-unavailable');
});
function response(identifier = 'notification-1', kind = 'invite', actionIdentifier = 'default') {
  return { actionIdentifier, notification: { request: { identifier, content: { data: { kind, userId: OWNER, challengeId: ID } } } } };
}
test('cold and live responses deduplicate; listener cleanup prevents stale navigation', async () => {
  lastResponse = response(); clears = 0; removed = 0; const opens = [];
  const stop = listenForNotificationResponses((target) => opens.push(target));
  receive(lastResponse); await Promise.resolve(); await Promise.resolve();
  assert.equal(opens.length, 1); assert.equal(clears, 1);
  receive(response('notification-2', 'friend_request', 'dismiss')); assert.equal(opens.length, 1);
  receive(response('notification-2', 'friend_request', 'open')); assert.equal(opens.at(-1).path, '/friends/requests');
  stop(); receive(response('notification-3')); assert.equal(opens.length, 2); assert.equal(removed, 1); lastResponse = null;
});
test('local notifications respect permission and configure all five categories without prompting', async () => {
  const service = new NotificationService(); categories.length = 0; scheduled.length = 0; channels.length = 0;
  granted = false; assert.equal(await service.scheduleLocal('friend_request', 'Request', 'Message', { userId: OWNER }), null);
  assert.equal(scheduled.length, 0); granted = true;
  assert.equal(await service.scheduleLocal('achievement_unlocked', 'Badge', 'Message', { userId: OWNER }), 'local-id');
  assert.equal(categories.length, 5); assert.ok(channels.includes('workout-rest'));
  assert.equal(scheduled[0].content.categoryIdentifier, 'achievement_unlocked');
  await assert.rejects(service.scheduleLocal('challenge_invite', 'Invite', 'Message', { userId: OWNER, challengeId: 'abc' }), { code: 'VALIDATION' });
});
test('web notification listening is a no-op', () => {
  platform.OS = 'web'; const before = removed; listenForNotificationResponses(() => assert.fail('No web listener'))();
  assert.equal(removed, before); platform.OS = 'android';
});
test('push payload categories match native category registration', () => {
  for (const [kind, category] of [['friend_request', 'friend_request'], ['achievement_unlocked', 'achievement_unlocked'], ['invite', 'challenge_invite'], ['ending_soon', 'challenge_ending_soon']]) assert.equal(notificationCategory({ kind }), category);
  assert.equal(notificationCategory(null), undefined);
});
test('friend request trigger uses private outbox and has no client execute grant', () => {
  const sql = readFileSync('supabase/migrations/202610070019_friend_request_notifications.sql', 'utf8');
  assert.match(sql, /security definer set search_path = ''/i); assert.match(sql, /new.addressee_id/);
  assert.match(sql, /private.challenge_push_outbox/); assert.match(sql, /revoke all.*from public,anon,authenticated/i);
  assert.doesNotMatch(sql, /grant execute/i);
});
test('a later rest notification using the same identifier is not mistaken for a duplicate tap', async () => {
  lastResponse = null; const opens = [];
  const stop = listenForNotificationResponses((target) => opens.push(target));
  const first = { actionIdentifier: 'default', notification: { date: 1000, request: { identifier: 'rest-session', content: { data: { kind: 'workout-rest', sessionId: ID, userId: OWNER } } } } };
  receive(first); receive(first); receive({ ...first, notification: { ...first.notification, date: 2000 } });
  assert.equal(opens.length, 2); stop(); await Promise.resolve();
});
test('one foreground handler suppresses rest banners only while active and cleans up', async () => {
  const stop = new NotificationService().initialize();
  const notification = (kind) => ({ request: { content: { data: { kind } } } });
  appState.currentState = 'active';
  assert.equal((await handler.handleNotification(notification('workout-rest'))).shouldShowBanner, false);
  assert.equal((await handler.handleNotification(notification('friend_request'))).shouldShowBanner, true);
  appState.currentState = 'background';
  assert.equal((await handler.handleNotification(notification('workout-rest'))).shouldShowBanner, true);
  stop(); assert.equal(handler, null); appState.currentState = 'active';
});
