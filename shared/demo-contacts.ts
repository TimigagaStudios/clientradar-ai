// Conservative link rendering for demo previews and exports. A well-formed
// contact is not proof of ownership, availability, or permission to contact.
export function demoEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  const email = value.trim();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email)) return '';
  // Reject URL delimiters and escapes rather than interpreting mailto headers.
  if (/[?#%]/.test(email) || email.includes('..') || email.split('@')[0].length > 64 || /@example\.(com|org|net)$/i.test(email)) return '';
  return email;
}

export function demoPhone(value: unknown): string {
  if (typeof value !== 'string') return '';
  const phone = value.trim();
  if (!/^\+?[0-9().\-\s]+$/.test(phone) || /^(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(phone) || /^\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)\d{2}$/.test(phone) || /^\d{1,3}\.\d{4,}$/.test(phone)) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || /^(\d)\1{6,}$/.test(digits)) return '';
  return `${phone.startsWith('+') ? '+' : ''}${digits}`;
}

export function demoInstagram(value: unknown): string {
  if (typeof value !== 'string') return '';
  let handle = value.trim();
  if (/^https?:\/\//i.test(handle)) {
    try {
      const url = new URL(handle);
      if (!['http:', 'https:'].includes(url.protocol) || !/^(?:www\.)?instagram\.com$/i.test(url.hostname) || url.username || url.password || url.port || url.search || url.hash) return '';
      handle = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    } catch { return ''; }
  } else handle = handle.replace(/^@/, '');
  if (!/^[a-z0-9_](?:[a-z0-9._]{0,28}[a-z0-9_])?$/i.test(handle) || handle.includes('..')) return '';
  return handle;
}
