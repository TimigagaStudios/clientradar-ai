// The Master Agent's work queue: approved tasks run one after another, in their own server calls,
// while ClientRadar is open. It keeps going as you move between pages and picks up again after a reload.

export type WorkItem = { id: string; title: string; status: 'queued' | 'running' | 'done' | 'failed'; note?: string; ai?: boolean };
export type WorkState = { items: WorkItem[]; paused: boolean; finished: boolean };

const KEY = 'cr-work-queue';
const GAP_MS = 5000; // a short breath between tasks keeps the free AI limit (requests per minute) happy
let state: WorkState = { items: [], paused: false, finished: false };
let busy = false;
const listeners = new Set<(state: WorkState) => void>();

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage not available */ } };
const emit = () => { save(); listeners.forEach((listener) => listener(state)); };
const set = (next: Partial<WorkState>) => { state = { ...state, ...next }; emit(); };
const patch = (id: string, change: Partial<WorkItem>) => set({ items: state.items.map((item) => (item.id === id ? { ...item, ...change } : item)) });
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const getWork = () => state;
export function subscribeWork(listener: (state: WorkState) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const workActive = () => state.items.some((item) => item.status === 'queued' || item.status === 'running');

async function runOne(item: WorkItem, tries = 0): Promise<void> {
  patch(item.id, { status: 'running' });
  try {
    const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run', taskId: item.id }) });
    const text = await response.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* not JSON */ }
    if (response.status === 409 && /already done/i.test(String(body?.error || ''))) { patch(item.id, { status: 'done' }); return; }
    // After a reload the server may still be finishing this task: look again shortly, up to 6 times.
    if (response.status === 409 && /already running/i.test(String(body?.error || '')) && tries < 6) { await wait(20000); return runOne(item, tries + 1); }
    if (!body?.success) { patch(item.id, { status: 'failed', note: String(body?.error || `server error ${response.status}`).slice(0, 160) }); return; }
    const data = body.data || {};
    patch(item.id, { status: data.status === 'done' ? 'done' : 'failed', note: String(data.error || data.summary || '').slice(0, 160), ai: data.output?.generatedBy === 'ai' });
  } catch {
    patch(item.id, { status: 'failed', note: 'No connection. Try again from the AI Team page.' });
  }
}

async function pump() {
  if (busy) return;
  busy = true;
  try {
    for (;;) {
      if (state.paused) break;
      const next = state.items.find((item) => item.status === 'queued');
      if (!next) break;
      await runOne(next);
      if (state.items.some((item) => item.status === 'queued') && !state.paused) await wait(GAP_MS);
    }
    if (state.items.length && !workActive() && !state.finished) set({ finished: true });
  } finally {
    busy = false;
  }
}

// Adds approved tasks to the queue and starts working.
export function enqueueWork(items: { id: string; title: string }[]) {
  const have = new Set(state.items.map((item) => item.id));
  const kept = state.finished ? [] : state.items; // a finished batch that was already reported makes room for the next
  set({ items: [...kept, ...items.filter((item) => !have.has(item.id) || state.finished).map((item) => ({ id: item.id, title: item.title, status: 'queued' as const }))], finished: false, paused: false });
  void pump();
}
export function pauseWork() { if (workActive()) set({ paused: true }); }
export function resumeWork() { set({ paused: false }); void pump(); }
export function clearWork() { set({ items: [], paused: false, finished: false }); }

// After a reload: anything that was mid-run is asked again (the server refuses to run a task twice).
export function restoreWork() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.items)) {
      state = { items: saved.items.map((item: WorkItem) => (item.status === 'running' ? { ...item, status: 'queued' } : item)), paused: Boolean(saved.paused), finished: Boolean(saved.finished) };
      listeners.forEach((listener) => listener(state));
      if (workActive() && !state.paused) void pump();
    }
  } catch { /* nothing saved */ }
}

export function workSummary(current: WorkState = state) {
  const total = current.items.length;
  const done = current.items.filter((item) => item.status === 'done').length;
  const failed = current.items.filter((item) => item.status === 'failed').length;
  const ai = current.items.filter((item) => item.status === 'done' && item.ai).length;
  const running = current.items.find((item) => item.status === 'running') || null;
  return { total, done, failed, ai, running, left: total - done - failed };
}
