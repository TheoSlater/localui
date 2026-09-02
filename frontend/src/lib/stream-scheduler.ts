// Dirty-driven scheduler for ~30 Hz UI flushes during streaming.
// Only one pending timeout and one pending rAF at a time, idle when no dirty data.
export interface StreamScheduler {
  schedule: () => void;
  flushSync: () => void;
  dispose: () => void;
  getState: () => { hasPendingTimeout: boolean; hasPendingRaf: boolean };
}

export function createStreamScheduler(onFlush: () => void, interval = 32): StreamScheduler {
  let flushTimeout: number | null = null;
  let rafId: number | null = null;
  let flushPending = false;
  let lastFlushTime = performance.now();

  const doRafFlush = () => {
    flushPending = false;
    rafId = null;
    lastFlushTime = performance.now();
    onFlush();
  };

  const schedule = () => {
    if (flushTimeout !== null || flushPending) return;
    const elapsed = performance.now() - lastFlushTime;
    const delay = Math.max(0, interval - elapsed);
    flushTimeout = window.setTimeout(() => {
      flushTimeout = null;
      if (flushPending) return;
      flushPending = true;
      rafId = window.requestAnimationFrame(doRafFlush);
    }, delay);
  };

  const flushSync = () => {
    if (flushTimeout !== null) {
      window.clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
      flushPending = false;
    }
    lastFlushTime = performance.now();
    onFlush();
  };

  const dispose = () => {
    if (flushTimeout !== null) window.clearTimeout(flushTimeout);
    if (rafId !== null) window.cancelAnimationFrame(rafId);
    flushTimeout = null;
    rafId = null;
    flushPending = false;
  };

  const getState = () => ({
    hasPendingTimeout: flushTimeout !== null,
    hasPendingRaf: rafId !== null,
  });

  return { schedule, flushSync, dispose, getState };
}
