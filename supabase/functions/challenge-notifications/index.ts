import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { classifyPushHttp, classifyPushResponse, isRecord } from '../_shared/push-delivery.ts';
import { notificationCategory } from '../_shared/notification-category.ts';

function required(name:string):string { const value = Deno.env.get(name); if (!value) throw new Error(`Missing server configuration: ${name}`); return value; }
async function sameSecret(actual:string,expected:string):Promise<boolean> {
  const encoder = new TextEncoder(); const [a,b] = await Promise.all([actual,expected].map((text) => crypto.subtle.digest('SHA-256',encoder.encode(text))));
  const left = new Uint8Array(a), right = new Uint8Array(b); let difference = 0;
  for (let i=0;i<left.length;i++) difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return difference === 0;
}
Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed',{ status:405 });
  if (!(await sameSecret(request.headers.get('Authorization') ?? '',`Bearer ${required('CHALLENGE_CRON_SECRET')}`))) return new Response('Unauthorized',{ status:401 });
  try {
    const client = createClient(required('SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY'),{ auth:{ persistSession:false,autoRefreshToken:false } });
    const deadlines = await client.rpc('run_challenge_deadlines'); if (deadlines.error) throw deadlines.error;
    // Separate RPC transactions preserve profile-before-challenge lock ordering.
    const finalization = await client.rpc('finalize_achievement_challenges'); if (finalization.error) throw finalization.error;
    const achievements = await client.rpc('run_achievement_events'); if (achievements.error) throw achievements.error;
    const { data:jobs,error } = await client.rpc('claim_challenge_push_jobs'); if (error || !Array.isArray(jobs)) throw new Error('Could not claim push jobs');
    const expoAccess = Deno.env.get('EXPO_ACCESS_TOKEN');
    const headers:Record<string,string> = { 'Content-Type':'application/json',...(expoAccess ? { Authorization:`Bearer ${expoAccess}` } : {}) };
    let handled = 0;
    // Bounded concurrency; leases allow a crashed worker to recover without lost jobs.
    for (let offset=0;offset<jobs.length;offset+=5) await Promise.all(jobs.slice(offset,offset+5).map(async (job:unknown) => {
      if (!isRecord(job) || typeof job['id'] !== 'string' || typeof job['leaseId'] !== 'string' || typeof job['token'] !== 'string') throw new Error('Malformed push job');
      const phase = job['state'] === 'receipt' ? 'receipt':'pending';
      let result;
      try {
        const response = await fetch(phase === 'receipt' ? 'https://exp.host/--/api/v2/push/getReceipts' : 'https://exp.host/--/api/v2/push/send',{
          method:'POST',headers,signal:AbortSignal.timeout(10000),body:JSON.stringify(phase === 'receipt' ? { ids:[job['receiptId']] } : {
            to:job['token'],title:job['title'],body:job['body'],data:job['data'],sound:'default',channelId:'challenges',categoryId:notificationCategory(job['data']),ttl:3600,
          }),
        });
        if (!response.ok) result = classifyPushHttp(response.status);
        else {
          const body:unknown = await response.json(); const data = isRecord(body) ? body['data'] : undefined;
          const item = phase === 'receipt' && isRecord(data) && typeof job['receiptId'] === 'string' ? data[job['receiptId']] : Array.isArray(data) ? data[0] : data;
          result = classifyPushResponse(item,phase);
        }
      } catch { result = { outcome:'retry',receipt:null } as const; }
      const finished = await client.rpc('finish_challenge_push_job',{ p_id:job['id'],p_lease:job['leaseId'],p_outcome:result.outcome,p_receipt:result.receipt });
      if (finished.error) throw finished.error; handled++;
    }));
    return Response.json({ handled });
  } catch { return Response.json({ error:'Challenge notification processing failed; leased jobs will be retried.' },{ status:500 }); }
});
