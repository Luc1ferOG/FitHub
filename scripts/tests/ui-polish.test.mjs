import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
const modules = new Map();
function source(path) {
  if (!modules.has(path)) modules.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }), { identifier: path }));
  return modules.get(path);
}
const navigation = new SyntheticModule(['DarkTheme', 'DefaultTheme'], function () { this.setExport('DarkTheme', { colors: {} }); this.setExport('DefaultTheme', { colors: {} }); });
const platform = { OS: 'ios' }; const calls = []; let failHaptics = false;
const native = new SyntheticModule(['Platform'], function () { this.setExport('Platform', platform); });
const haptics = new SyntheticModule(['performAndroidHapticsAsync', 'notificationAsync', 'AndroidHaptics', 'NotificationFeedbackType'], function () {
  this.setExport('AndroidHaptics', { Confirm: 'confirm' }); this.setExport('NotificationFeedbackType', { Success: 'success' });
  this.setExport('performAndroidHapticsAsync', async (value) => { calls.push(['android', value]); if (failHaptics) throw Error('Unavailable'); });
  this.setExport('notificationAsync', async (value) => { calls.push(['ios', value]); if (failHaptics) throw Error('Unavailable'); });
});
async function load(path) {
  const module = source(path);
  await module.link((specifier, parent) => {
    if (specifier === '@react-navigation/native') return navigation;
    if (specifier === 'react-native') return native;
    if (specifier === 'expo-haptics') return haptics;
    return source(specifier.startsWith('@/') ? `src/${specifier.slice(2)}.ts` : `${posix.normalize(posix.join(posix.dirname(parent.identifier), specifier))}.ts`);
  }); await module.evaluate(); return module.namespace;
}
const { lightTheme, darkTheme } = await load('src/theme/themes.ts');
const { isCompactLayout } = await load('src/utils/responsive.ts');
const { completedSetFeedback } = await load('src/services/device/haptics.ts');
function luminance(hex) {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
for (const theme of [lightTheme, darkTheme]) {
  const name = theme.dark ? 'dark' : 'light';
  test(`${name} text and interactive foregrounds meet 4.5:1 contrast`, () => {
    const colors = theme.colors;
    for (const foreground of ['text', 'textMuted', 'primary', 'danger', 'success', 'warning']) {
      for (const background of ['background', 'surface']) assert.ok(contrast(colors[foreground], colors[background]) >= 4.5, `${foreground}/${background} ${name}`);
    }
    for (const [foreground, background] of [['primaryContrast', 'primary'], ['dangerContrast', 'danger'], ['warningContrast', 'warning']]) assert.ok(contrast(colors[foreground], colors[background]) >= 4.5, `${foreground}/${background} ${name}`);
  });
}
test('small Android and iPhone widths and dynamic text use compact presentation', () => {
  for (const width of [320, 360, 375]) assert.equal(isCompactLayout(width, 1), true);
  for (const width of [390, 412, 430]) assert.equal(isCompactLayout(width, 1), false);
  for (const width of [320, 390, 430]) assert.equal(isCompactLayout(width, 1.3), true);
});
test('haptics use native confirmation and failures never reject workout logging', async () => {
  calls.length = 0; platform.OS = 'ios'; await completedSetFeedback();
  platform.OS = 'android'; await completedSetFeedback();
  platform.OS = 'web'; await completedSetFeedback();
  assert.deepEqual(calls, [['ios', 'success'], ['android', 'confirm']]);
  platform.OS = 'android'; failHaptics = true; await assert.doesNotReject(completedSetFeedback()); failHaptics = false;
});
function files(path) { return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? entry.name === '__tests__' ? [] : files(`${path}/${entry.name}`) : entry.name.endsWith('.tsx') ? [`${path}/${entry.name}`] : []); }
test('presentation uses theme colors and never disables font scaling', () => {
  for (const path of [...files('src/features'), ...files('src/components')]) {
    const code = readFileSync(path, 'utf8');
    assert.doesNotMatch(code, /['"]#[0-9a-f]{3,8}['"]|['"]rgba?\(/i, path);
    assert.doesNotMatch(code, /allowFontScaling=\{false\}|maxFontSizeMultiplier=\{1\}/, path);
  }
});
test('reduced motion is subscribed centrally and animations cannot gate actions', () => {
  const preference = readFileSync('src/hooks/use-accessibility-preferences.ts', 'utf8');
  assert.match(preference, /reduceMotionChanged/); assert.match(preference, /screenReaderChanged/); assert.match(preference, /motion.remove\(\)/);
  const set = readFileSync('src/features/workouts/components/active-set-row.tsx', 'utf8');
  assert.match(set, /previousCompleted = useRef\(completed\)/); assert.match(set, /completed && !previousCompleted.current/);
  assert.match(set, /if \(reduceMotion\) scale.value = 1/); assert.match(set, /cancelAnimation\(scale\)/);
});
test('bottom sheets expose close, escape and busy safeguards without nested lists', () => {
  const modal = readFileSync('src/components/ui/modal-surface.tsx', 'utf8');
  assert.match(modal, /accessibilityViewIsModal/); assert.match(modal, /onAccessibilityEscape/);
  assert.match(modal, /if \(!busyRef.current\) onClose\(\)/); assert.match(modal, /setAccessibilityFocus/);
  for (const path of ['src/features/workouts/components/exercise-picker.tsx', 'src/features/challenges/components/invite-friends-picker.tsx']) {
    const code = readFileSync(path, 'utf8'); assert.match(code, /presentation="sheet" scroll=\{false\}/); assert.match(code, /FlatList/);
  }
});
test('buttons retain busy labels and merge semantic state with actual disabled state', () => {
  const button = readFileSync('src/components/ui/button.tsx', 'utf8');
  assert.match(button, /\.\.\.accessibilityState, disabled: Boolean\(isDisabled\), busy: loading/);
  assert.match(button, /\{label\}<\/Text>/); assert.match(readFileSync('src/constants/app.ts', 'utf8'), /MINIMUM_TOUCH_TARGET = 48/);
});
