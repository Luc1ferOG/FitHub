// Local test backend only. Never execute with a production service-role key.
import { mkdirSync, writeFileSync } from 'node:fs';
const endpoint = new URL(process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || endpoint.username || endpoint.password || endpoint.protocol !== 'http:') throw new Error('Only a loopback local Supabase HTTP endpoint is permitted.');
const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_PASSWORD;
const runId = process.env.E2E_RUN_ID;
if (!key || !password || password.length < 8 || !runId || !/^[a-z0-9_]{1,16}$/.test(runId)) throw new Error('Set E2E_SUPABASE_SERVICE_ROLE_KEY, E2E_PASSWORD (8+ characters) and E2E_RUN_ID (1–16 lowercase letters/digits/underscores).');
const email = `e2e_${runId}@example.test`;
const response = await fetch(new URL('/auth/v1/admin/users', endpoint), { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username: `e2e_${runId}`, display_name: 'E2E Athlete' } }), signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`Test account provisioning failed (${response.status}); use a new run ID. No credentials logged.`);
const user = await response.json();
if (typeof user.id !== 'string') throw new Error('Local Auth response lacked a user ID.');
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/e2e-fixture.json', JSON.stringify({ userId: user.id, email, runId }, null, 2));
console.log(`Provisioned local test actor. Set E2E_EMAIL=${email}. Password and service key were not saved.`);
