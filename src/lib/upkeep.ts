// Asks the Records Upkeep Agent to bring older leads up to date (map positions, unread websites).
// Runs quietly after sign-in, at most once every 6 hours, in small batches.

const STAMP = 'cr-upkeep-last';
let running = false;

export type UpkeepTotals = { placed: number; approximate: number; notFound: number; scanned: number; emails: number; remaining: number; skipped: string | null };

async function post(body: unknown) {
  const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await response.text();
  try { return JSON.parse(text); } catch { return null; }
}

export async function runUpkeep(options: { force?: boolean; maxRounds?: number } = {}): Promise<UpkeepTotals | null> {
  if (running) return null;
  try {
    const last = Number(localStorage.getItem(STAMP) || 0);
    if (!options.force && Date.now() - last < 6 * 60 * 60 * 1000) return null;
  } catch { /* storage not available */ }
  running = true;
  const total: UpkeepTotals = { placed: 0, approximate: 0, notFound: 0, scanned: 0, emails: 0, remaining: 0, skipped: null };
  try {
    for (let round = 0; round < (options.maxRounds ?? 10); round += 1) {
      const answer = await post({ action: 'upkeep' });
      const data = answer?.data;
      if (!answer?.success || !data) break;
      total.placed += data.placed || 0;
      total.approximate += data.approximate || 0;
      total.notFound += data.notFound || 0;
      total.scanned += data.scanned || 0;
      total.emails += data.emails || 0;
      total.remaining = data.remaining || 0;
      total.skipped = data.skipped || null;
      const worked = (data.placed || 0) + (data.approximate || 0) + (data.notFound || 0) + (data.scanned || 0);
      if (!data.remaining || (!worked && round > 0)) break;
    }
    if (total.placed + total.approximate + total.notFound + total.scanned > 0) await post({ action: 'upkeep', summary: total });
    try { localStorage.setItem(STAMP, String(Date.now())); } catch { /* ignore */ }
    return total;
  } catch {
    return null;
  } finally {
    running = false;
  }
}
