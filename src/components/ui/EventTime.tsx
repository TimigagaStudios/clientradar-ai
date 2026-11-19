import { useState, useSyncExternalStore } from 'react';
import { eventTime } from '../../lib/event-time';

// One shared clock for all visible timestamps, rather than a timer per row.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!timer) timer = setInterval(() => listeners.forEach((notify) => notify()), 60000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) { clearInterval(timer); timer = undefined; }
  };
};
const clock = () => Math.floor(Date.now() / 60000);

export default function EventTime({ value, label }: { value?: string | null; label: string }) {
  const [showExact, setShowExact] = useState(false);
  useSyncExternalStore(subscribe, clock, clock);
  const time = eventTime(value);
  if (!time) return null;
  return <span className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
    <span>{label}</span>
    <time dateTime={time.iso} title={time.exact} aria-label={`${label}: ${time.relative}, ${time.exact}`}>{time.relative}</time>
    <button type="button" aria-expanded={showExact} aria-label={`${showExact ? 'Hide' : 'Show'} exact time for ${label}`} onClick={() => setShowExact(!showExact)} className="font-semibold underline decoration-dotted underline-offset-2">{showExact ? 'Hide' : 'Exact'}</button>
    {showExact && <span>{time.exact}</span>}
  </span>;
}
