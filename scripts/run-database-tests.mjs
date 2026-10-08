import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
if (!process.env.FITHUB_TEST_DATABASE_URL) throw new Error('Set FITHUB_TEST_DATABASE_URL to a migrated, seeded LOCAL test database.');
const database = new URL(process.env.FITHUB_TEST_DATABASE_URL);
if (!['postgres:', 'postgresql:'].includes(database.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname)) throw new Error('Rollback fixtures are restricted to a loopback test database.');
// Keep credentials out of command arguments, artifacts and application environment files.
const env = { ...process.env, PGHOST: database.hostname.replace(/^\[|\]$/g, ''), PGPORT: database.port || '54322', PGUSER: decodeURIComponent(database.username), PGPASSWORD: decodeURIComponent(database.password), PGDATABASE: decodeURIComponent(database.pathname.slice(1)), PGCONNECT_TIMEOUT: '10' };
delete env.FITHUB_TEST_DATABASE_URL;
let failed = false;
for (const file of readdirSync('supabase/tests').filter((file) => file.endsWith('.sql')).sort()) {
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', `supabase/tests/${file}`], { stdio: 'inherit', env, timeout: 60000 });
  console.log(`${file}: ${result.status === 0 ? 'passed' : 'failed'}`);
  if (result.status !== 0) {
    if (result.error?.code === 'ENOENT') throw new Error('psql command not found. Install PostgreSQL client tools.');
    if (result.error) console.error(result.error.message);
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
