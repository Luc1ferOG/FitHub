import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
if (!existsSync('artifacts/verification.json')) throw new Error('Run npm run test:verify before generating a report.');
const verification = JSON.parse(readFileSync('artifacts/verification.json', 'utf8'));
const jest = verification.checks.find((check) => check.name === 'jest');
const fresh = (file) => existsSync(file) && statSync(file).mtimeMs >= Date.parse(verification.startedAt);
const coverageFile = 'artifacts/coverage/coverage-summary.json';
const coverage = jest?.status !== 'blocked' && jest?.status !== 'not-run' && fresh(coverageFile)
  ? JSON.parse(readFileSync(coverageFile, 'utf8')).total : null;
// Empty VM/source-map reports and previous runs cannot establish application coverage.
const measured = coverage && ['lines', 'branches', 'functions', 'statements'].every((key) => coverage[key]?.total > 0);
const resultFile = 'artifacts/jest-results.json';
const results = jest?.status !== 'blocked' && fresh(resultFile) ? JSON.parse(readFileSync(resultFile, 'utf8')) : null;
const countFiles = (directory) => readdirSync(directory, { withFileTypes: true }).reduce((count, entry) => count + (entry.isDirectory() ? countFiles(`${directory}/${entry.name}`) : /\.test\.tsx?$/.test(entry.name) ? 1 : 0), 0);
const rows = verification.checks.map((check) => `| ${check.name} | ${check.status} | ${check.tests ? `${check.passed}/${check.tests} passing in ${check.suites} files` : check.reason ?? `[Execution log](../${check.log})`} |`).join('\n');
const coverageText = measured
  ? ['lines', 'branches', 'functions', 'statements'].map((key) => `| ${key} | ${coverage[key].pct}% | 70% | ${coverage[key].pct >= 70 ? 'met' : 'below target'} |`).join('\n')
  : '| All dimensions | Not measured | 70% | Not established |';
const report = `# FitHub testing report

Generated from the verification run beginning ${verification.startedAt} and ending ${verification.completedAt}.

## Execution

| Check | Result | Evidence / prerequisite |
| --- | --- | --- |
${rows}

Jest/RNTL inventory: ${countFiles('src')} test files. ${results ? `${results.numPassedTests}/${results.numTotalTests} tests passed; ${results.numPassedTestSuites}/${results.numTotalTestSuites} suites passed.` : 'Jest suites have not been executed successfully in this environment.'}

The dependency-free core runner includes behavioral tests, real SQLite persistence tests and static source/SQL contract checks. Its passing count is not Jest coverage, component verification or PostgreSQL execution.

## Coverage

| Dimension | Measured | Gate | Status |
| --- | --- | --- | --- |
${coverageText}

Jest enforces 70% statements, branches, functions and lines across application source, including screens and adapters. Only tests, fixtures, declaration files and type directories are excluded. No production feature is excluded to raise coverage. Empty V8 reports from VM-loaded modules are discarded; a displayed 100% on zero tracked files is not valid coverage. A configured gate is not proof the target has been reached.

## Critical Maestro scenarios

| Flow | Assertions |
| --- | --- |
| 01 authentication | Register a fresh user, reach Home, log out, log in again, reach Home |
| 02 workout | Create template, choose seeded exercise, configure/save, start, log set, finish, verify summary, save |
| 03 challenge | Create public challenge, creator enrollment, leave/rejoin, verify membership and leaderboard position |
| 04 measurements | Create metric measurement, verify history, return to dashboard and verify latest weight |

Device execution status: ${verification.checks.find((check) => check.name === 'maestro')?.status ?? 'not-run'}. Auth, networking, storage, notifications and database are not mocked in Maestro. Scenario definitions are not passing E2E results.

## Scope and limitations

New Jest tests exercise real form validation, password visibility, busy/error states, exercise selection, unit switching, durable-session invariants, threshold rules and multi-service workflows. Client integration tests replace repository/network boundaries, not domain services. Simulated server receipts in these tests do not verify SQL scoring or Auth profile triggers; rollback-only SQL suites verify those against an actual database when executed.

Read [testing guide](testing.md) for commands, external mocking policy, fixture setup, SQL security regressions and the exact added/changed file manifest. Resolve blocked checks, run the full gate and inspect uncovered branches before claiming 70% useful coverage or release readiness.
`;
writeFileSync('docs/test-report.md', report); console.log('Created docs/test-report.md');
