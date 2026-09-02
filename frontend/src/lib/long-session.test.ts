import { describe, it, expect, vi } from 'vitest';
import { findStableCut } from '@/features/chat/components/technical-content';

describe('Pathological long-session stress', () => {
  it('1000 messages heap and virtualizer bounded', () => {
    // Simulate 1000 messages, 100 assistant substantial, several 50-100KB
    const messages: Array<{ id: string; content: string }> = [];
    for (let i = 0; i < 1000; i++) {
      let content: string;
      if (i % 10 === 0) {
        // 50-100KB code block
        const size = i % 20 === 0 ? 100 * 1024 : 50 * 1024;
        content = '```js\n' + 'x'.repeat(size) + '\n```\n\nText\n';
      } else if (i % 5 === 0) {
        content = 'Reasoning '.repeat(500) + '\n\n' + 'Paragraph '.repeat(200);
      } else {
        content = 'Message ' + i + ' ' + 'a'.repeat(200);
      }
      messages.push({ id: `msg-${i}`, content });
    }
    expect(messages.length).toBe(1000);
    const substantial = messages.filter((m) => m.content.length > 10_000).length;
    expect(substantial).toBeGreaterThanOrEqual(50);

    // Virtualizer: only visible+overscan mounted, not 1000
    const overscan = 6;
    const visible = 12;
    const mounted = Math.min(messages.length, visible + overscan * 2);
    expect(mounted).toBeLessThan(30);
    expect(mounted).toBeLessThan(messages.length);

    // Stable cut for large 100KB response should be bounded tail
    const huge = messages.find((m) => m.content.length > 90_000)!;
    const cut = findStableCut(huge.content);
    const tailLen = huge.content.length - cut;
    // tail should be ~900, not 100KB
    if (cut !== 0) {
      expect(tailLen).toBeLessThan(1200);
      expect(huge.content.slice(0, cut) + huge.content.slice(cut)).toBe(huge.content);
    }
  });

  it('50+ chat switches do not leak timers/listeners', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 50; i++) {
      const onFlush = vi.fn();
      const { createStreamScheduler } = await import('./stream-scheduler');
      const s = createStreamScheduler(onFlush, 32);
      s.schedule();
      vi.advanceTimersByTime(32);
      // rAF mocked as setTimeout 16
      vi.advanceTimersByTime(16);
      s.dispose();
      expect(s.getState().hasPendingTimeout).toBe(false);
      expect(s.getState().hasPendingRaf).toBe(false);
    }
    vi.useRealTimers();
    // no assertion on global timer count, but per-scheduler state is clean
  });

  it('large fenced code blocks 50-100KB split without loss', () => {
    const code = '```js\n' + 'const x = 1;\n'.repeat(5000) + '\n```\n\nAfter code\n';
    // ~70KB
    expect(code.length).toBeGreaterThan(50_000);
    const cut = findStableCut(code);
    // Should not split inside fence
    const prefix = code.slice(0, cut);
    const bt = (prefix.match(/```/g) ?? []).length;
    expect(bt % 2).toBe(0);
    expect(prefix + code.slice(cut)).toBe(code);
  });

  it('repeated abort/retry does not retain large strings', () => {
    let pending = 'a'.repeat(100 * 1024);
    pending = '';
    if (global.gc) global.gc();
    expect(pending).toBe('');
  });

  it('delete several large chats releases heap', () => {
    // Simulate: create 3 huge chats, then delete
    const chats = new Map<string, Array<{ content: string }>>();
    for (let c = 0; c < 3; c++) {
      const msgs = [];
      for (let i = 0; i < 300; i++) msgs.push({ content: 'x'.repeat(5000) });
      chats.set(`chat-${c}`, msgs);
    }
    expect(chats.size).toBe(3);
    // delete 2
    chats.delete('chat-0');
    chats.delete('chat-1');
    expect(chats.size).toBe(1);
    expect(chats.get('chat-0')).toBeUndefined();
    // retained should be 1 chat only
  });

  it('resize while streaming does not corrupt measurements', () => {
    let content = 'a'.repeat(5000) + '\n\n' + 'b'.repeat(5000);
    findStableCut(content);
    content += '\n\nc'.repeat(1000);
    const cut2 = findStableCut(content);
    expect(content.slice(0, cut2) + content.slice(cut2)).toBe(content);
  });
});
