import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStreamScheduler } from './stream-scheduler';

describe('StreamScheduler ~30 Hz dirty scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // mock rAF to use setTimeout so fake timers control it
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(performance.now()), 16) as unknown as number;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      window.clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('at most one pending timeout', () => {
    const onFlush = vi.fn();
    const s = createStreamScheduler(onFlush, 32);
    s.schedule();
    s.schedule();
    s.schedule();
    expect(s.getState().hasPendingTimeout).toBe(true);
    // only one timeout should be pending (checked via state, not count, but we can count setTimeout calls)
    // advance 10ms, still pending, not flushed
    vi.advanceTimersByTime(10);
    expect(onFlush).not.toHaveBeenCalled();
    s.dispose();
  });

  it('at most one pending rAF', () => {
    const onFlush = vi.fn();
    const s = createStreamScheduler(onFlush, 32);
    s.schedule();
    // fast forward to timeout firing (32ms) -> should schedule rAF
    vi.advanceTimersByTime(32);
    expect(s.getState().hasPendingRaf).toBe(true);
    // schedule again while rAF pending should be no-op
    s.schedule();
    expect(s.getState().hasPendingRaf).toBe(true);
    // advance 16ms rAF
    vi.advanceTimersByTime(16);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(s.getState().hasPendingRaf).toBe(false);
    s.dispose();
  });

  it('no idle scheduler after streaming stops (dispose clears)', () => {
    const onFlush = vi.fn();
    const s = createStreamScheduler(onFlush, 32);
    s.schedule();
    s.dispose();
    expect(s.getState().hasPendingTimeout).toBe(false);
    expect(s.getState().hasPendingRaf).toBe(false);
    vi.advanceTimersByTime(100);
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('dirty chunks coalesce correctly', () => {
    const onFlush = vi.fn();
    const s = createStreamScheduler(onFlush, 32);
    // 10 rapid schedules should coalesce to 1 flush
    for (let i = 0; i < 10; i++) s.schedule();
    vi.advanceTimersByTime(32);
    vi.advanceTimersByTime(16);
    expect(onFlush).toHaveBeenCalledTimes(1);
    // again 5 schedules after flush should coalesce to 1 more
    for (let i = 0; i < 5; i++) s.schedule();
    vi.advanceTimersByTime(32);
    vi.advanceTimersByTime(16);
    expect(onFlush).toHaveBeenCalledTimes(2);
    s.dispose();
  });

  it('UI flush rate remains around ~30 Hz ceiling', () => {
    const onFlush = vi.fn();
    const s = createStreamScheduler(onFlush, 32);
    // simulate 100 chunks arriving at 5ms interval (200 Hz)
    // but scheduler should cap to ~31 Hz
    for (let t = 0; t < 200; t += 5) {
      s.schedule();
      vi.advanceTimersByTime(5);
      // need to also advance rAF when it fires
      if (vi.getMockedSystemTime) {
      } // noop
    }
    // advance remaining timers to flush
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(16);
    // 200ms /32 ≈ 6 flushes max, not 40
    expect(onFlush.mock.calls.length).toBeLessThanOrEqual(8);
    expect(onFlush.mock.calls.length).toBeGreaterThanOrEqual(4);
    s.dispose();
  });

  it('final synchronous flush exactly matches accumulated', () => {
    let pending = 'hello';
    let lastFlushed = '';
    const onFlush = vi.fn(() => {
      lastFlushed = pending;
    });
    const s = createStreamScheduler(onFlush, 32);
    s.schedule();
    // before flush, pending changes
    pending = 'hello world';
    vi.advanceTimersByTime(32);
    vi.advanceTimersByTime(16);
    expect(lastFlushed).toBe('hello world');
    // final sync flush should capture latest even if not scheduled
    pending = 'hello world!!!';
    // simulate flushSync
    s.flushSync();
    expect(lastFlushed).toBe('hello world!!!');
    s.dispose();
  });

  it('abort clears all scheduled work', () => {
    const onFlush = vi.fn();
    const s = createStreamScheduler(onFlush, 32);
    s.schedule();
    expect(s.getState().hasPendingTimeout).toBe(true);
    s.dispose();
    expect(s.getState().hasPendingTimeout).toBe(false);
    expect(s.getState().hasPendingRaf).toBe(false);
    vi.advanceTimersByTime(100);
    expect(onFlush).not.toHaveBeenCalled();
  });
});
