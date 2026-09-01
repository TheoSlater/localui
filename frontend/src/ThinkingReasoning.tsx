import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './ThinkingReasoning.module.css';
import { ThinkingState } from './ThinkingState';

interface ThinkingReasoningProps {
  reasoning?: string;
  streaming?: boolean;
}

export function ThinkingReasoning({ reasoning = '', streaming = false }: ThinkingReasoningProps) {
  const [open, setOpen] = useState(false);
  const startedAt = useRef(Date.now());
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

  useEffect(() => {
    if (!streaming) {
      setElapsed(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
      return;
    }
    const timer = window.setInterval(
      () => setElapsed(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [streaming]);

  if (!streaming && !hasReasoning) return null;

  const expanded = streaming || open;
  return (
    <div className={styles.tr + (expanded ? '' : ` ${styles.isCollapsed}`)}>
      <button
        type="button"
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
      </button>
      <div className={styles.trCollapsible + (expanded ? '' : ` ${styles.isCollapsed}`)}>
        <div className={styles.trInner}>
          <div className={styles.trViewport}>
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
