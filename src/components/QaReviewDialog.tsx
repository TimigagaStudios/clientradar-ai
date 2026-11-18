import { useEffect, useRef, useState } from 'react';

type Finding = { demoId: string; state: string; issues: string[] };
type Review = { token: string; demos: Finding[] };

export class QaRequestError extends Error {
  constructor(message: string, public code = '', public review: any = null) { super(message); }
}

// The quality override is a separate tap from approval to send. If content or
// review changes, the server rejects the old token and the user must retry.
export function useQaReview() {
  const [review, setReview] = useState<Review | null>(null);
  const [stage, setStage] = useState<'review' | 'send'>('review');
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  const ask = (next: Review) => new Promise<boolean>((resolve) => {
    if (pending.current) { resolve(false); return; }
    pending.current = resolve;
    setStage('review');
    setReview(next);
  });
  const finish = (accepted: boolean) => {
    const done = pending.current;
    pending.current = null;
    setReview(null);
    done?.(accepted);
  };
  async function post(url: string, body: Record<string, unknown>) {
    const request = async (data: Record<string, unknown>) => {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      let result: any = null;
      try { result = JSON.parse(await response.text()); } catch { /* not JSON */ }
      return { response, result };
    };
    let { response, result } = await request(body);
    if (response.status === 409 && result?.code === 'QA_REVIEW_REQUIRED' && typeof result?.review?.token === 'string' && Array.isArray(result?.review?.demos)) {
      const token = result.review.token;
      if (!(await ask(result.review))) throw new Error('Not sent. Quality review or sending was cancelled.');
      ({ response, result } = await request({ ...body, qaOverride: true, qaToken: token, confirm: true }));
    }
    if (!response.ok || !result?.success) throw new QaRequestError(result?.code === 'QA_REVIEW_REQUIRED' ? 'Demo or review changed. Nothing was sent; try again to review the new status.' : result?.error || `Server error ${response.status}`, result?.code || '', result?.review || null);
    return result.data;
  }
  const dialog = review && (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} role="dialog" aria-modal="true" aria-label={stage === 'review' ? 'Review demo quality' : 'Confirm sending'}>
      <div className="neo-card w-full max-w-lg p-5 space-y-3">
        {stage === 'review' ? <>
          <h3 className="text-lg font-black text-[var(--text-primary)]">Review demo quality first</h3>
          <p className="text-sm text-[var(--text-secondary)]">A linked demo is unchecked, stale, failed or has possible issues. These limited checks do not verify all facts, links, visuals or safety. Nothing has been sent.</p>
          <div className="max-h-[40vh] overflow-y-auto rounded-xl neo-in p-3 text-sm text-[var(--text-primary)]">
            {review.demos.map((demo, index) => <div key={`${demo.demoId}-${index}`} className="mb-3 last:mb-0 break-words">
              <p className="font-bold">Demo {demo.demoId}: {demo.state}</p>
              {demo.issues.length > 0 && <ul className="list-disc pl-5">{demo.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
            </div>)}
          </div>
          <p className="text-xs text-[var(--text-secondary)]">Override this QA review only? You will still be asked to approve the actual send.</p>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setStage('send')} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: '#FF7A00' }}>Override QA</button><button type="button" onClick={() => finish(false)} className="neo-button rounded-full px-4 py-2 text-sm font-bold text-[var(--text-primary)]">Cancel</button></div>
        </> : <>
          <h3 className="text-lg font-black text-[var(--text-primary)]">Approve this email send?</h3>
          <p className="text-sm text-[var(--text-secondary)]">The QA override does not send anything by itself. Confirm separately to send this email now.</p>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => finish(true)} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: '#FF7A00' }}>Yes, send this email</button><button type="button" onClick={() => finish(false)} className="neo-button rounded-full px-4 py-2 text-sm font-bold text-[var(--text-primary)]">Cancel</button></div>
        </>}
      </div>
    </div>
  );
  return { postWithQaReview: post, qaReviewDialog: dialog };
}
