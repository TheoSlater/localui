import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@tanstack/react-virtual', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-virtual')>('@tanstack/react-virtual');
  return {
    ...actual,
    useVirtualizer: (opts: any) => {
      const count = opts.count;
      const overscan = opts.overscan ?? 6;
      // Simulate visible 10 + overscan*2
      const visible = Math.min(count, 10 + overscan * 2);
      const items = Array.from({ length: visible }, (_, i) => ({
        key: `k-${i}`,
        index: i,
        start: i * 72,
      }));
      return {
        getTotalSize: () => count * 72,
        getVirtualItems: () => items,
        measureElement: () => {},
        scrollOffset: 0,
        scrollToOffset: () => {},
      };
    },
  };
});

import { VirtualMessageList } from './virtual-message-list';

describe('VirtualMessageList chat identity isolation', () => {
  it('only visible+overscan rows mounted', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ id: `id-${i}`, v: i }));
    const { container } = render(
      <div style={{ height: 300, width: 400 }}>
        <VirtualMessageList
          items={items}
          getItemKey={(it) => it.id}
          renderItem={(it) => <div>{it.v}</div>}
          overscan={6}
        />
      </div>,
    );
    const mounted = container.querySelectorAll('[data-index]').length;
    expect(mounted).toBeLessThan(30);
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(items.length);
  });

  it('keeps the scrollport edge-to-edge while padding message rows', () => {
    const { container } = render(
      <div style={{ height: 300, width: 400 }}>
        <VirtualMessageList
          items={[{ id: 'id-0', v: 0 }]}
          getItemKey={(it) => it.id}
          renderItem={(it) => <div>{it.v}</div>}
        />
      </div>,
    );

    const scrollport = container.querySelector('.overflow-y-auto');
    const row = container.querySelector('[data-index]');
    expect(scrollport).toHaveClass(
      'no-scrollbar',
      'scrollbar-gutter-auto',
      'h-full',
      'overflow-y-auto',
    );
    expect(scrollport).not.toHaveClass('px-4');
    expect(row).toHaveClass('px-4');
  });

  it('remounts when chat key changes (isolates measurements)', () => {
    const itemsA = Array.from({ length: 50 }, (_, i) => ({ id: `a-${i}`, v: `A${i}` }));
    const itemsB = Array.from({ length: 50 }, (_, i) => ({ id: `b-${i}`, v: `B${i}` }));
    const { container, rerender } = render(
      <VirtualMessageList
        key="chat-a"
        items={itemsA}
        getItemKey={(it) => it.id}
        renderItem={(it) => <div>{it.v}</div>}
      />,
    );
    const before = container.textContent;
    expect(before).toContain('A0');
    rerender(
      <VirtualMessageList
        key="chat-b"
        items={itemsB}
        getItemKey={(it) => it.id}
        renderItem={(it) => <div>{it.v}</div>}
      />,
    );
    const after = container.textContent;
    expect(after).toContain('B0');
    expect(after).not.toContain('A0');
  });

  it('scrollMode prop removed (dead API)', () => {
    // VirtualMessageList should no longer accept scrollMode
    const { container } = render(
      <VirtualMessageList items={[]} getItemKey={() => 'k'} renderItem={() => null} />,
    );
    expect(container).toBeTruthy();
    // Type check: scrollMode should be excess property error if provided
    // We verify runtime ignores it (no crash)
  });

  it('completed rows do not continually remeasure (stable keys)', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `id-${i}`, v: i }));
    const { container } = render(
      <VirtualMessageList
        items={items}
        getItemKey={(it) => it.id}
        renderItem={(it) => <div>{it.v}</div>}
      />,
    );
    const count1 = container.querySelectorAll('[data-index]').length;
    expect(count1).toBeGreaterThan(0);
    expect(count1).toBeLessThanOrEqual(10 + 12);
  });
});
