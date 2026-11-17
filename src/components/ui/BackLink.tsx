import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

// BrowserRouter's index is zero on a direct entry, so never leave the app for an external referrer.
export default function BackLink({ fallback, className, children }: { fallback: string; className?: string; children?: ReactNode }) {
  const navigate = useNavigate();
  return <button type="button" className={className} onClick={() => {
    if (typeof window !== 'undefined' && typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }}>{children || 'Back'}</button>;
}
