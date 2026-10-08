import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { performance } from 'node:perf_hooks';

const code = stripTypeScriptTypes(readFileSync('src/features/workouts/services/session-history-selector.ts', 'utf8'), { mode: 'transform' });
const { createSessionHistorySelector } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const repeats = 250;
function measure(project, sessions) {
  const samples = [];
  let previous = project(sessions);
  let changedReferences = 0;
  for (let i = 0; i < repeats + 50; i++) {
    const next = [...sessions]; next[0] = { ...next[0], notes: `Set entry ${i}` };
    const start = performance.now(); const result = project(next); const elapsed = performance.now() - start;
    if (i >= 50) { samples.push(elapsed); if (result !== previous) changedReferences++; }
    previous = result;
  }
  samples.sort((a, b) => a - b);
  return { medianMs: +samples[Math.floor(samples.length / 2)].toFixed(3),
    p95Ms: +samples[Math.ceil(samples.length * 0.95) - 1].toFixed(3), changedReferences };
}
const results = [];
for (const count of [500, 5000]) for (const order of ['chronological', 'shuffled']) {
  // Deterministic permutation, not an artificially expensive random sort.
  const sessions = Array.from({ length: count }, (_, i) => ({ id: `session-${i}`, userId: 'owner', name: 'Workout',
    startedAt: order === 'chronological' ? i : (i * 73) % count, submittedAt: i,
    syncStatus: 'synced', notes: '', exercises: [] }));
  const before = (rows) => rows.filter((row) => row.userId === 'owner').sort((a, b) => b.startedAt - a.startedAt);
  const after = createSessionHistorySelector('owner', 30);
  results.push({ count, order, before: measure(before, sessions), after: measure(after, sessions) });
}
console.log(JSON.stringify({ runtime: process.version, platform: process.platform, arch: process.arch,
  measured: 'Warm history projection for metadata-unchanged logging; excludes React, storage, native layout and image work',
  repeats, results }, null, 2));
