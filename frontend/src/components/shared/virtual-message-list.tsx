import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef } from 'react';

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

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (scrollToBottomRequest) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    else if (autoScroll) element.scrollTop = element.scrollHeight;
  }, [autoScroll, items.length, scrollToBottomRequest]);

  useEffect(() => {
    if (!onAtBottomChange) return;
    const element = scrollRef.current;
    const update = () => {
      if (!element) return;
      const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
      onAtBottomChange(atBottom);
    };
    element?.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      element?.removeEventListener('scroll', update);
    };
  }, [onAtBottomChange]);

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
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() + bottomPadding }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full"
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            {renderItem(items[virtualItem.index])}
          </div>
        ))}
      </div>
    </div>
  );
}
