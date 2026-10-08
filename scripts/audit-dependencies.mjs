import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const production = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(path) && !/\.test\./.test(path)) production.push(readFileSync(path, 'utf8'));
  }
}
walk('src');
const sources = production.join('\n') + readFileSync('app.json', 'utf8') + manifest.main;
const peers = {
  'expo-splash-screen': 'Expo Router splash/startup integration',
  'react-native-screens': 'Expo Router/native stack peer',
  'react-native-worklets': 'Reanimated 4 runtime peer',
  'react-native-web': 'Configured Expo web target',
  'react-dom': 'React Native Web renderer',
};
const direct = []; const runtimePeers = []; const review = [];
for (const dependency of Object.keys(manifest.dependencies)) {
  if (sources.includes(`'${dependency}'`) || sources.includes(`"${dependency}"`) ||
    sources.includes(`'${dependency}/`) || sources.includes(`"${dependency}/`) || manifest.main.startsWith(`${dependency}/`)) direct.push(dependency);
  else if (peers[dependency]) runtimePeers.push({ dependency, reason: peers[dependency] });
  else review.push(dependency);
}
console.log(JSON.stringify({ note: 'Static production reference/config scan, not tree shaking or a bundle-size measurement',
  productionSourceFiles: production.length, direct, runtimePeers, review }, null, 2));
