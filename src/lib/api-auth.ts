import { supabase } from './supabase';

// Adds the logged-in user's session token to every request this app makes to
// its own /api/ endpoints, so the server can check who is calling.
// Requests to other addresses are left untouched.
const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    const address = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(address, window.location.origin);
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        init = { ...init, headers };
      }
      // Capture the device-local minor mode only for a QA-capable action.
      // It is never an approval to build a demo, run a task, or send email.
      if (init?.method?.toUpperCase() === 'POST' && typeof init.body === 'string') {
        let body: any;
        try { body = JSON.parse(init.body); } catch { body = null; }
        const qaAction = url.pathname === '/api/demo-jobs' && (body?.action === 'process' || body?.action === 'qa-recheck');
        const teamAction = url.pathname === '/api/team' && body?.action === 'run';
        const legacyAction = /^\/api\/demo-jobs\/[^/]+$/.test(url.pathname);
        if (body && (qaAction || teamAction || legacyAction)) {
          let qaMinor = false;
          try { qaMinor = localStorage.getItem('cr-auto-minor') === 'on'; } catch { /* default off */ }
          init = { ...init, body: JSON.stringify({ ...body, qaMinor }) };
        }
      }
    }
  } catch {
    // If anything goes wrong here, send the request unchanged.
  }
  return originalFetch(input, init);
};

export {};
