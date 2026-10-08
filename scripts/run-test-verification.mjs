import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
mkdirSync('artifacts', { recursive: true });
const startedAt = new Date().toISOString();
const npmCli = process.env.npm_execpath;
const npm = (script) => npmCli
  ? [process.execPath, [npmCli, 'run', script], false]
  : [process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], process.platform === 'win32'];
const coreFiles = readdirSync('scripts/tests').filter((file) => file.endsWith('.test.mjs')).sort();
const checks = [];
function run(name, command, args, shell = false) {
  const started = Date.now();
  const logPath = `artifacts/${name}.log`;
  // File descriptors avoid Windows sandbox restrictions on child-process capture pipes.
  const descriptor = openSync(logPath, 'w');
  let result;
  try { result = spawnSync(command, args, { cwd: root, shell, stdio: ['inherit', descriptor, descriptor], timeout: 300_000 }); }
  finally { closeSync(descriptor); }
  const output = `${readFileSync(logPath, 'utf8')}\n${result.error?.message ?? ''}`;
  writeFileSync(logPath, output);
  const unavailable = ['ENOENT', 'EPERM', 'EACCES'].includes(result.error?.code) || /not recognized|command not found|Cannot find module.*(?:jest|typescript|expo)|ENOTCACHED/i.test(output);
  const status = result.status === 0 ? 'passed' : unavailable ? 'blocked' : 'failed';
  const record = { name, status, exitCode: result.status, durationMs: Date.now() - started, log: `artifacts/${name}.log` };
  if (name === 'core') {
    record.suites = coreFiles.length;
    record.tests = Number(output.match(/# tests (\d+)/)?.[1] ?? 0);
    record.passed = Number(output.match(/# pass (\d+)/)?.[1] ?? 0);
    record.failed = Number(output.match(/# fail (\d+)/)?.[1] ?? 0);
  }
  checks.push(record); console.log(`${name}: ${status}${record.tests ? ` (${record.passed}/${record.tests} tests)` : ''}`);
}
run('core', process.execPath, ['--experimental-vm-modules', '--test', '--test-reporter=tap', '--test-isolation=none', ...coreFiles.map((file) => path.join('scripts/tests', file))]);
for (const [name, script] of [['jest', 'test:coverage'], ['integration', 'test:integration'], ['typecheck', 'typecheck'], ['lint', 'lint'], ['database-static', 'db:verify'], ['syntax', 'performance:syntax'],
  ['production-config', 'production:config'], ['production-dependencies', 'production:dependencies'],
  ['production-android-export', 'production:android'], ['production-ios-export', 'production:ios']]) run(name, ...npm(script));
if (process.env.FITHUB_RUN_E2E === '1') run('maestro', ...npm('test:e2e'));
else checks.push({ name: 'maestro', status: 'not-run', reason: 'Requires a provisioned test backend, installed development build and running device. Set FITHUB_RUN_E2E=1 to execute.' });
if (process.env.FITHUB_TEST_DATABASE_URL) run('database-integration', ...npm('test:database'));
else checks.push({ name: 'database-integration', status: 'not-run', reason: 'Rollback-only SQL suites require a migrated local Supabase/PostgreSQL instance and psql. Set FITHUB_TEST_DATABASE_URL to execute.' });
writeFileSync('artifacts/verification.json', JSON.stringify({ startedAt, completedAt: new Date().toISOString(), checks }, null, 2));
run('report', process.execPath, ['scripts/create-test-report.mjs']);
// Missing tools and unexecuted end-to-end/security checks are not a verified release.
process.exitCode = checks.some((check) => check.status !== 'passed') ? 1 : 0;
if (!existsSync('docs/test-report.md')) process.exitCode = 1;
