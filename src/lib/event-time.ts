// Display only timestamps supplied by a record. Invalid or missing values stay unknown.
export function eventTime(value: unknown, now = Date.now()): { iso: string; relative: string; exact: string } | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  const millis = date.getTime();
  if (!Number.isFinite(millis) || !Number.isFinite(now)) return null;
  const delta = millis - now;
  const magnitude = Math.abs(delta);
  let relative: string;
  if (magnitude < 60000) {
    relative = delta > 0 ? 'in less than a minute' : 'just now';
  } else {
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 365.25 * 86400000], ['month', 30.4375 * 86400000],
      ['day', 86400000], ['hour', 3600000], ['minute', 60000],
    ];
    const [unit, size] = units.find(([, duration]) => magnitude >= duration) || units[units.length - 1];
    const amount = Math.floor(magnitude / size) * (delta < 0 ? -1 : 1);
    relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' }).format(amount, unit);
  }
  const exact = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    second: '2-digit', timeZoneName: 'short',
  }).format(date);
  return { iso: date.toISOString(), relative, exact };
}
