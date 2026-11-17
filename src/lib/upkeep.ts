// Asks the Records Upkeep Agent to bring older leads up to date (map positions, unread websites).
// Runs quietly after sign-in, at most once every 6 hours, in small batches.

const STAMP = 'cr-upkeep-last';
let running = false;

export type UpkeepTotals = { placed: number; approximate: number; notFound: number; scanned: number; emails: number; remaining: number; skipped: string | null; services: number };

async function post(body: unknown) {
  const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await response.text();
  try { return JSON.parse(text); } catch { return null; }
}

export async function runUpkeep(options: { force?: boolean; maxRounds?: number } = {}): Promise<UpkeepTotals | null> {
  if (running) return null;
  try { if (localStorage.getItem('cr-auto-minor') !== 'on') return null; } catch { return null; }
  try {
    const last = Number(localStorage.getItem(STAMP) || 0);
    if (!options.force && Date.now() - last < 6 * 60 * 60 * 1000) return null;
  } catch { /* storage not available */ }
  running = true;
  const total: UpkeepTotals = { placed: 0, approximate: 0, notFound: 0, scanned: 0, emails: 0, remaining: 0, skipped: null, services: 0 };
  try {
    for (let round = 0; round < Math.min(options.maxRounds ?? 1, 1); round += 1) {
      try { if (localStorage.getItem('cr-auto-minor') !== 'on') break; } catch { break; }
      const answer = await post({ action: 'upkeep' });
      const data = answer?.data;
      if (!answer?.success || !data) break;
      total.placed += data.placed || 0;
      total.approximate += data.approximate || 0;
      total.notFound += data.notFound || 0;
      total.scanned += data.scanned || 0;
      total.emails += data.emails || 0;
      total.services += data.services || 0;
      total.remaining = data.remaining || 0;
      total.skipped = data.skipped || null;
      const worked = (data.placed || 0) + (data.approximate || 0) + (data.notFound || 0) + (data.scanned || 0);
      if (!data.remaining || (!worked && round > 0)) break;
    }
    if (total.placed + total.approximate + total.notFound + total.scanned + total.services > 0) {
      await post({ action: 'upkeep', summary: total });
      // The floating Master Agent orb tells the owner what was done.
      const mapped = total.placed + total.approximate;
      const parts = [mapped ? `placed ${mapped} ${mapped === 1 ? 'lead' : 'leads'} on the globe` : '', total.emails ? `found ${total.emails} ${total.emails === 1 ? 'email' : 'emails'} on lead websites` : '', total.services ? `listed ${total.services} ${total.services === 1 ? 'service' : 'services'} in the Tracker` : ''].filter(Boolean);
      if (parts.length) window.dispatchEvent(new CustomEvent('cr-notice', { detail: { text: `Records check done: I ${parts.join(', ')}.`, to: mapped ? '/globe' : total.services ? '/tracker' : '/leads', yes: mapped ? 'Show the globe' : total.services ? 'Open Tracker' : 'Open leads' } }));
    }
    try { localStorage.setItem(STAMP, String(Date.now())); } catch { /* ignore */ }
    return total;
  } catch {
    return null;
  } finally {
    running = false;
  }
}
