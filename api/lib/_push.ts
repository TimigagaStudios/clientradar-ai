import { sendNotification, setVapidDetails } from 'web-push';

// Lock-screen push notifications for the installed PWA (Phase 0 of the app plan).
// The owner subscribes from Settings; the server sends when something important happens:
// a client reply, drafts ready for approval, a demo finished. Free: Web Push needs no
// Apple account. Env (names only): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.

const subject = () => String(process.env.VAPID_SUBJECT || 'mailto:contact.timigaga@gmail.com').trim();

export function pushConfigured(): boolean {
  return Boolean(String(process.env.VAPID_PUBLIC_KEY || '').trim() && String(process.env.VAPID_PRIVATE_KEY || '').trim());
}

export function pushPublicKey(): string {
  return String(process.env.VAPID_PUBLIC_KEY || '').trim();
}

// Catches the classic mistakes (swapped keys, truncated copy, wrong format) before
// they turn into silent failures. Returns a plain message, or null when all is well.
export function vapidProblem(): string | null {
  if (!pushConfigured()) return 'The VAPID keys are missing in Vercel.';
  try {
    const pub = Buffer.from(pushPublicKey(), 'base64url');
    if (pub.length !== 65 || pub[0] !== 4) return 'The public key in Vercel is not a valid VAPID public key. Generate fresh keys and paste them again.';
    const priv = Buffer.from(String(process.env.VAPID_PRIVATE_KEY || '').trim(), 'base64url');
    if (priv.length !== 32) return 'The private key in Vercel has the wrong shape (it must decode to 32 bytes). Generate fresh keys and paste them again.';
  } catch {
    return 'One of the VAPID keys in Vercel is not readable. Generate fresh keys and paste them again.';
  }
  return null;
}

let vapidSet = false;
function ensureVapid() {
  if (vapidSet) return;
  setVapidDetails(subject(), pushPublicKey(), String(process.env.VAPID_PRIVATE_KEY || '').trim());
  vapidSet = true;
}

export async function saveSubscription(supabase: any, sub: any) {
  const endpoint = String(sub?.endpoint || '').trim();
  const p256dh = String(sub?.keys?.p256dh || '').trim();
  const auth = String(sub?.keys?.auth || '').trim();
  if (!endpoint || !p256dh || !auth) throw new Error('That subscription is not usable');
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint, p256dh, auth, last_used_at: new Date().toISOString() },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(/push_subscriptions/.test(String(error.message)) ? 'The notifications table is missing: run migration 009 in Supabase' : error.message);
  return { saved: true };
}

export interface PushMessage { title: string; body: string; url?: string; tag?: string }

// Sends to every subscribed device. Expired subscriptions are removed. Never throws:
// a notification failure must never break the work that triggered it.
export async function sendPush(supabase: any, message: PushMessage): Promise<{ sent: number; errors: string[] }> {
  if (!pushConfigured()) return { sent: 0, errors: ['The VAPID keys are missing in Vercel.'] };
  const errors: string[] = [];
  try {
    ensureVapid();
    const { data: rows } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').limit(20);
    if (!rows?.length) return { sent: 0, errors: ['No device is subscribed yet.'] };
    const payload = JSON.stringify({ title: message.title, body: message.body, url: message.url || '/', tag: message.tag || 'clientradar' });
    let sent = 0;
    await Promise.all((rows || []).map(async (row: any) => {
      try {
        await sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 3600, urgency: 'normal' });
        sent += 1;
        await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', row.id);
      } catch (error: any) {
        const status = Number(error?.statusCode || 0);
        if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('id', row.id);
        else errors.push(`Push service said ${status || 'error'}: ${String(error?.message || error).slice(0, 120)}`);
      }
    }));
    return { sent, errors };
  } catch (error: any) {
    return { sent: 0, errors: [String(error?.message || error).slice(0, 160)] };
  }
}
