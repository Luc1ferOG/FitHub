export function dashboardDay(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}
export function dashboardClock(now = new Date()) {
  return { now, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', day: dashboardDay(now) };
}
