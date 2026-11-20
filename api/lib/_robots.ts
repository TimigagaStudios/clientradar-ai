// Conservative robots policy for additional page discovery. This is not access
// authorization and does not claim to implement every REP extension. If a rule
// is ambiguous or unsupported, callers must skip additional page requests.

type Rule = { allow: boolean; pattern: string };
type Group = { agents: string[]; rules: Rule[]; delay: boolean };
export type RobotsPolicy = { rules: Rule[] };

export function parseRobots(text: string): RobotsPolicy | null {
  if (text.length > 524288 || text.includes('\0')) return null;
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 10000) return null;
  const groups: Group[] = []; let group: Group | null = null; let sawRule = false; let ruleCount = 0;
  for (const raw of lines) {
    const line = raw.split('#', 1)[0].trim();
    if (!line) continue;
    const colon = line.indexOf(':'); if (colon < 0) return null;
    const key = line.slice(0, colon).trim().toLowerCase(); const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      const agent = value.toLowerCase();
      if (!/^(?:\*|[a-z_-]+)$/.test(agent)) return null;
      if (!group || sawRule) { group = { agents: [], rules: [], delay: false }; groups.push(group); sawRule = false; }
      group.agents.push(agent);
    } else if (key === 'allow' || key === 'disallow') {
      if (!group) return null;
      sawRule = true;
      if (!value) continue;
      // Percent encodings, non-ASCII and unrecognized metacharacters are
      // deliberately not interpreted: stop instead of guessing permission.
      if (!value.startsWith('/') || value.length > 256 || /[^\x21-\x7e]|[%\\\[\]{}()]/.test(value) || value.slice(0, -1).includes('$')) return null;
      if (++ruleCount > 2000) return null;
      group.rules.push({ allow: key === 'allow', pattern: value });
    } else if (key === 'crawl-delay') {
      if (!group) return null;
      sawRule = true; group.delay = true;
    }
  }
  const specific = groups.filter((item) => item.agents.includes('clientradarai'));
  const selected = specific.length ? specific : groups.filter((item) => item.agents.includes('*'));
  if (selected.some((item) => item.delay)) return null;
  return { rules: selected.flatMap((item) => item.rules) };
}

function matches(path: string, raw: string): boolean {
  const anchored = raw.endsWith('$'); const pattern = anchored ? raw.slice(0, -1) : `${raw}*`;
  let previous = new Uint8Array(path.length + 1); previous[0] = 1;
  for (const char of pattern) {
    const next = new Uint8Array(path.length + 1);
    if (char === '*') {
      next[0] = previous[0];
      for (let i = 1; i <= path.length; i += 1) next[i] = previous[i] || next[i - 1] ? 1 : 0;
    } else {
      for (let i = 1; i <= path.length; i += 1) if (previous[i - 1] && path[i - 1] === char) next[i] = 1;
    }
    previous = next;
  }
  return previous[path.length] === 1;
}

export function robotsAllows(policy: RobotsPolicy, path: string): boolean {
  if (!path.startsWith('/') || path.length > 200 || /[^\x21-\x7e]|[%?#\\]/.test(path)) return false;
  // Bound dynamic-programming work on hostile files. Failure is conservative.
  if (policy.rules.reduce((sum, rule) => sum + rule.pattern.length + 1, 0) * (path.length + 1) > 1000000) return false;
  let best = -1; let allow = true;
  for (const rule of policy.rules) {
    if (!matches(path, rule.pattern)) continue;
    const rank = rule.pattern.replace(/[\*$]/g, '').length;
    if (rank > best || (rank === best && rule.allow)) { best = rank; allow = rule.allow; }
  }
  return allow;
}
