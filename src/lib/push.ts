// Lock-screen notifications for the installed PWA (Phase 0 of the app plan).
// iPhone only delivers these to the installed app (Add to Home Screen), never to a
// browser tab. The server sends; this file only subscribes and reports the state.

export type PushState = 'unsupported' | 'not-installed' | 'denied' | 'off' | 'on' | 'not-configured' | 'bad-keys';

const call = async (body: Record<string, unknown>) => {
  const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let result: any = null;
  try { result = JSON.parse(await response.text()); } catch { /* not JSON */ }
  if (!response.ok || !result?.success) throw new Error(result?.error || `server error ${response.status}`);
  return result.data;
};

const urlBase64 = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushInstalled = () => {
  if (typeof window === 'undefined') return false;
  const nav = navigator as any;
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
};

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (!pushInstalled()) return 'not-installed';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const key = await call({ action: 'push-key' });
    if (!key?.configured) return 'not-configured';
    if (key?.problem) return 'bad-keys';
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('This browser cannot do push notifications.');
  if (!pushInstalled()) throw new Error('Add ClientRadar to your Home Screen first (Share, then Add to Home Screen), then open it from the icon.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. Allow them in the phone settings, then try again.');
  const key = await call({ action: 'push-key' });
  if (!key?.configured) throw new Error('The server is not set up for notifications yet (VAPID keys missing in Vercel).');
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64(String(key.publicKey)) });
  await call({ action: 'push-subscribe', subscription: subscription.toJSON() });
}

export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    // Also remove the server record, so a stale subscription can never linger.
    try { await call({ action: 'push-unsubscribe', endpoint }); } catch { /* already gone */ }
  }
}

export async function testPush(): Promise<{ sent: number; errors: string[] }> {
  const out = await call({ action: 'push-test' });
  return { sent: Number(out?.sent || 0), errors: Array.isArray(out?.errors) ? out.errors : [] };
}
