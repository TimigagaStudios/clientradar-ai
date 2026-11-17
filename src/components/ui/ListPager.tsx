import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUp } from 'lucide-react';

export interface PagedListState<T> {
  visible: T[];
  total: number;
  start: number;
  end: number;
  step: number;
  expanded: boolean;
  canExpandMore: boolean;
  canPrev: boolean;
  canNext: boolean;
  remainingAfterView: number;
  showMore: () => void;
  collapse: () => void;
  prevPage: () => void;
  nextPage: () => void;
  firstPage: () => void;
}

export function usePagedList<T>(
  items: readonly T[],
  resetKey = '',
  step = 10,
  maxWindow = 50,
): PagedListState<T> {
  const [start, setStart] = useState(0);
  const [count, setCount] = useState(step);

  useEffect(() => {
    setStart(0);
    setCount(step);
  }, [resetKey, step]);

  const total = items.length;
  const safeStart = total === 0 ? 0 : start >= total ? Math.max(0, Math.floor((total - 1) / step) * step) : start;
  const safeCount = Math.max(step, Math.min(count, maxWindow));
  const end = Math.min(total, safeStart + safeCount);

  const visible = useMemo(
    () => items.slice(safeStart, end),
    [items, safeStart, end],
  );

  const remainingAfterView = Math.max(0, total - end);
  const canExpandMore = remainingAfterView > 0 && safeCount < maxWindow;
  const expanded = end - safeStart > step;
  const canPrev = safeStart > 0;
  const canNext = end < total;

  const showMore = () => {
    if (remainingAfterView <= 0) return;
    if (safeCount < maxWindow) {
      setStart(safeStart);
      setCount(Math.min(maxWindow, safeCount + step));
      return;
    }
    setStart(end);
    setCount(step);
  };

  const collapse = () => {
    setCount(step);
  };

  const prevPage = () => {
    if (!canPrev) return;
    setStart(Math.max(0, safeStart - step));
    setCount(step);
  };

  const nextPage = () => {
    if (!canNext) return;
    setStart(end);
    setCount(step);
  };

  const firstPage = () => {
    setStart(0);
    setCount(step);
  };

  return {
    visible,
    total,
    start: safeStart,
    end,
    step,
    expanded,
    canExpandMore,
    canPrev,
    canNext,
    remainingAfterView,
    showMore,
    collapse,
    prevPage,
    nextPage,
    firstPage,
  };
}

interface ListPagerProps<T> {
  pager: PagedListState<T>;
  noun?: string;
  className?: string;
  compact?: boolean;
}

export function ListPager<T>({
  pager,
  noun = 'items',
  className = '',
  compact = false,
}: ListPagerProps<T>) {
  if (pager.total <= pager.step && pager.start === 0) return null;

  const nextReveal = Math.min(pager.step, pager.remainingAfterView);

  return (
    <div
      data-list-pager
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-2xl neo-in ${compact ? 'px-3.5 py-2.5' : 'px-4 py-3'} text-xs ${className}`}
    >
      <span className="font-semibold text-[var(--text-secondary)]">
        Showing{' '}
        <strong className="text-[var(--text-primary)]">
          {(pager.start + 1).toLocaleString()}-{pager.end.toLocaleString()}
        </strong>{' '}
        of <strong className="text-[var(--text-primary)]">{pager.total.toLocaleString()}</strong> {noun}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        {pager.canPrev && (
          <>
            {pager.start >= pager.step * 2 && (
              <button
                type="button"
                onClick={pager.firstPage}
                className="neo-button rounded-full px-3 py-1.5 font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                First 10
              </button>
            )}
            <button
              type="button"
              onClick={pager.prevPage}
              data-pager-prev
              className="neo-button rounded-full px-3 py-1.5 font-bold text-[var(--text-primary)] inline-flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Prev 10
            </button>
          </>
        )}

        {pager.canExpandMore && (
          <button
            type="button"
            onClick={pager.showMore}
            data-pager-more
            className="neo-button rounded-full px-3.5 py-1.5 font-bold text-[var(--accent)] inline-flex items-center gap-1"
          >
            <ChevronDown size={14} /> Show {nextReveal} more ({pager.remainingAfterView.toLocaleString()} left)
          </button>
        )}

        {pager.canNext && (
          <button
            type="button"
            onClick={pager.nextPage}
            data-pager-next
            className="neo-button rounded-full px-3 py-1.5 font-bold text-[var(--text-primary)] inline-flex items-center gap-1"
          >
            Next 10 <ChevronRight size={14} />
          </button>
        )}

        {pager.expanded && (
          <button
            type="button"
            onClick={pager.collapse}
            data-pager-collapse
            className="neo-button rounded-full px-3 py-1.5 font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1"
          >
            <ChevronsUp size={14} /> Collapse to {pager.step}
          </button>
        )}
      </div>
    </div>
  );
}

export default ListPager;
