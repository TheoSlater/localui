import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import styles from './thinking-reasoning.module.css';
import { ThinkingState } from './thinking-state';

const MAX_REASONING_HEIGHT = 180;
const REASONING_LINE_HEIGHT = 40;
const REASONING_LINE_GAP = 4;

interface ThinkingReasoningProps {
  reasoning?: string;
  streaming?: boolean;
}

export function ThinkingReasoning({ reasoning = '', streaming = false }: ThinkingReasoningProps) {
  const [open, setOpen] = useState(false);
  const startedAt = useRef(Date.now());
  const viewportRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(1);
  const lines = useMemo(
    () =>
      reasoning
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean),
    [reasoning],
  );
  const visibleLines = lines.length ? lines : streaming ? [''] : [];
  const hasReasoning = reasoning.trim().length > 0;
  const contentHeight = visibleLines.length
    ? visibleLines.length * REASONING_LINE_HEIGHT + (visibleLines.length - 1) * REASONING_LINE_GAP
    : 0;
  const viewportHeight = Math.min(MAX_REASONING_HEIGHT, contentHeight);
  const capped = contentHeight > MAX_REASONING_HEIGHT;

  useEffect(() => {
    if (streaming) startedAt.current = Date.now();
  }, [streaming]);

  useEffect(() => {
    if (!streaming) {
      setElapsed(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
      return;
    }
    setElapsed(1);
    const timer = window.setInterval(
      () => setElapsed(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [streaming]);

  useEffect(() => {
    if (streaming && capped && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [capped, contentHeight, streaming]);

  if (!streaming && !hasReasoning) return null;

  const expanded = streaming || open;
  return (
    <div className={styles.tr + (expanded ? '' : ` ${styles.isCollapsed}`)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={styles.trHeader + (streaming ? '' : ` ${styles.isClickable}`)}
        aria-expanded={expanded}
        aria-label="Toggle thought"
        onClick={streaming ? undefined : () => setOpen((value) => !value)}
      >
        {streaming ? (
          <ThinkingState />
        ) : (
          <span className={styles.trLabel}>
            <span className={styles.trVerb}>Thought</span> for {elapsed}s
          </span>
        )}
        {!streaming && (
          <svg
            className={styles.trChevron}
            viewBox="0 0 24 24"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <path
              d="m4.5 15.75 7.5-7.5 7.5 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </Button>
      <div className={styles.trCollapsible + (expanded ? '' : ` ${styles.isCollapsed}`)}>
        <div className={styles.trInner}>
          <div
            ref={viewportRef}
            className={
              styles.trViewport + (capped && !streaming && open ? ` ${styles.isScroll}` : '')
            }
            style={{ height: `${viewportHeight}px` }}
          >
            <div className={styles.trStream}>
              {visibleLines.map((line, index) => (
                <p key={index} className={styles.trSentence}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
