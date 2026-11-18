import { inspectQaMessage } from '../../api/lib/_qa-agent';

// The same deterministic rules run again on the server before a send. This
// preview does not approve a send or verify factual accuracy.
export default function DraftQa({ subject, body, external = false }: { subject: string; body: string; external?: boolean }) {
  const result = inspectQaMessage(subject, body);
  return <div className="rounded-xl neo-in p-3 text-xs text-[var(--text-primary)]" data-draft-quality>
    <p className="font-bold">Message wording preview: {result.findings.length} possible {result.findings.length === 1 ? 'issue' : 'issues'}</p>
    {result.findings.length > 0 && <ul className="mt-1 list-disc pl-5">{result.findings.map((finding, index) => <li key={`${finding.path}-${finding.code}-${index}`}>{finding.message} ({finding.path})</li>)}</ul>}
    <p className="mt-1 text-[var(--text-secondary)]">Limited pattern checks do not verify all facts or tone. Review the message yourself. {external ? 'This preview does not compare the saved lead or website. Copying does not send; outside apps control their own sending.' : 'Lead and available website contacts are compared in the send review. Sending still needs your approval.'}</p>
  </div>;
}
