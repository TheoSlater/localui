import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef } from 'react';

const AUTO_SCROLL_EASE = 0.22;
const AUTO_SCROLL_EPSILON = 0.5;

export interface ScrollSnapshot {
  scrollOffset: number;
  anchorId?: string | number;
}

interface VirtualMessageListProps<T> {
  items: T[];
  getItemKey: (item: T) => string | number;
  renderItem: (item: T) => React.ReactNode;
  overscan?: number;
  snapshot?: ScrollSnapshot;
  onSnapshotChange?: (snapshot: ScrollSnapshot) => void;
  autoScroll?: boolean;
  scrollToBottomRequest?: number;
  onAtBottomChange?: (atBottom: boolean) => void;
  bottomPadding?: number;
}

export function VirtualMessageList<T>({
  items,
  getItemKey,
  renderItem,
  overscan = 6,
  snapshot,
  onSnapshotChange,
  autoScroll = false,
  scrollToBottomRequest = 0,
  onAtBottomChange,
  bottomPadding = 0,
}: VirtualMessageListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const autoScrollingRef = useRef(false);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const getKey = useCallback(
    (index: number) => {
      const item = itemsRef.current[index];
      return item !== undefined ? getItemKey(item) : index;
    },
    [getItemKey],
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: getKey,
    estimateSize: () => 72,
    overscan,
    scrollMargin: 0,
  });
  const totalSize = virtualizer.getTotalSize();
  const lastItem = items[items.length - 1];

  const cancelAutoScroll = useCallback(() => {
    autoScrollingRef.current = false;
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const finish = () => {
      element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      autoScrollingRef.current = false;
      scrollFrameRef.current = null;
      onAtBottomChange?.(true);
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    autoScrollingRef.current = true;
    if (scrollFrameRef.current !== null) return;
    const step = () => {
      const current = scrollRef.current;
      if (!current || !autoScrollingRef.current) {
        scrollFrameRef.current = null;
        return;
      }
      const target = Math.max(0, current.scrollHeight - current.clientHeight);
      const distance = target - current.scrollTop;
      if (Math.abs(distance) <= AUTO_SCROLL_EPSILON) {
        finish();
        return;
      }
      current.scrollTop += distance * AUTO_SCROLL_EASE;
      scrollFrameRef.current = window.requestAnimationFrame(step);
    };
    scrollFrameRef.current = window.requestAnimationFrame(step);
  }, [onAtBottomChange]);

  useEffect(() => {
    if (!scrollToBottomRequest || !scrollRef.current) return;
    scrollToBottom();
  }, [scrollToBottom, scrollToBottomRequest]);

  useEffect(() => {
    if (autoScroll) scrollToBottom();
    else cancelAutoScroll();
  }, [autoScroll, cancelAutoScroll, lastItem, scrollToBottom, totalSize]);

  useEffect(() => cancelAutoScroll, [cancelAutoScroll]);

  useEffect(() => {
    if (!onAtBottomChange) return;
    const element = scrollRef.current;
    const update = () => {
      if (!element) return;
      const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
      onAtBottomChange(autoScrollingRef.current || atBottom);
    };
    element?.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      element?.removeEventListener('scroll', update);
    };
  }, [onAtBottomChange]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const interrupt = () => cancelAutoScroll();
    element.addEventListener('pointerdown', interrupt, { passive: true });
    element.addEventListener('touchstart', interrupt, { passive: true });
    element.addEventListener('wheel', interrupt, { passive: true });
    return () => {
      element.removeEventListener('pointerdown', interrupt);
      element.removeEventListener('touchstart', interrupt);
      element.removeEventListener('wheel', interrupt);
    };
  }, [cancelAutoScroll]);

  const snapshotOffset = snapshot?.scrollOffset;
  useEffect(() => {
    if (snapshotOffset !== undefined)
      virtualizer.scrollToOffset(snapshotOffset, { align: 'start' });
  }, [snapshotOffset, virtualizer]);

  useEffect(() => {
    if (!onSnapshotChange) return;
    let raf = 0;
    let pending = false;
    const updateSnapshot = () => {
      if (pending) return;
      pending = true;
      raf = window.requestAnimationFrame(() => {
        pending = false;
        onSnapshotChange({
          scrollOffset: virtualizer.scrollOffset ?? 0,
          anchorId: virtualizer.getVirtualItems()[0]?.key?.toString(),
        });
      });
    };
    const element = scrollRef.current;
    element?.addEventListener('scroll', updateSnapshot, { passive: true });
    return () => {
      element?.removeEventListener('scroll', updateSnapshot);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [onSnapshotChange, virtualizer]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="relative w-full" style={{ height: totalSize + bottomPadding }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full [content-visibility:auto]"
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            {renderItem(items[virtualItem.index])}
          </div>
        ))}
      </div>
    </div>
  );
}
