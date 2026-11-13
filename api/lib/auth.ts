import type { VercelRequest, VercelResponse } from '@vercel/node';

// Login check for the API. Every private endpoint calls requireUser first.
// The browser sends the Supabase session token as "Authorization: Bearer <token>".
// Optional settings (names only, values live in Vercel):
//   API_ALLOWED_EMAILS  comma-separated list; when set, only these accounts may use the API.
//   API_AUTH_DISABLED   set to "true" to switch the check off in an emergency.

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function deny(res: VercelResponse, status: number, error: string) {
  res.status(status).json({ success: false, error });
  return false;
}

export async function requireUser(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (process.env.API_AUTH_DISABLED === 'true') return true;
  if (!supabaseUrl || !serviceRoleKey) return deny(res, 500, 'Missing Supabase environment variables');

  const header = req.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header || '';
  const token = value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
  if (!token) return deny(res, 401, 'Please log in to continue.');

  let user: any = null;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401 || response.status === 403) return deny(res, 401, 'Your session has expired. Please log in again.');
    if (!response.ok) return deny(res, 503, 'Could not check your login. Please try again.');
    user = await response.json();
  } catch {
    return deny(res, 503, 'Could not check your login. Please try again.');
  }
  if (!user?.id) return deny(res, 401, 'Your session has expired. Please log in again.');

  const allowed = (process.env.API_ALLOWED_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(String(user.email || '').toLowerCase())) return deny(res, 403, 'This account is not allowed to use this workspace.');
  return true;
}
