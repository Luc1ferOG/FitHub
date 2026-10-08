export type DeliveryOutcome = { outcome:'done'|'retry'|'receipt'|'failed'|'unregistered'; receipt:string|null };
export function isRecord(value:unknown): value is Record<string,unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function classifyPushResponse(value:unknown, phase:'pending'|'receipt'): DeliveryOutcome {
  if (!isRecord(value)) return { outcome:'retry',receipt:null };
  if (value['status'] === 'ok') {
    if (phase === 'receipt') return { outcome:'done',receipt:null };
    if (typeof value['id'] === 'string') return { outcome:'receipt',receipt:value['id'] };
    return { outcome:'retry',receipt:null };
  }
  const details = value['details']; const error = isRecord(details) ? details['error'] : null;
  return { outcome:error === 'DeviceNotRegistered' ? 'unregistered' : error === 'MessageTooBig' || error === 'InvalidCredentials' ? 'failed' : 'retry',receipt:null };
}
export function classifyPushHttp(status:number): DeliveryOutcome {
  return { outcome:status === 429 || status >= 500 ? 'retry':'failed',receipt:null };
}
