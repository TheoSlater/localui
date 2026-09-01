import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';

export interface ScrollSnapshot {
  scrollOffset: number;
  anchorId?: string | number;
}

interface VirtualMessageListProps<T> {
  items: T[];
  getItemKey: (item: T) => string | number;
  renderItem: (item: T) => React.ReactNode;
  scrollMode?: 'element' | 'window';
  overscan?: number;
  snapshot?: ScrollSnapshot;
  onSnapshotChange?: (snapshot: ScrollSnapshot) => void;
}

export function VirtualMessageList<T>({
  items,
  getItemKey,
  renderItem,
  scrollMode = 'element',
  overscan = 6,
  snapshot,
  onSnapshotChange,
}: VirtualMessageListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const options = {
    count: items.length,
    getItemKey: (index) => getItemKey(items[index]),
    estimateSize: () => 56,
    overscan,
    shouldAdjustScrollPositionOnItemSizeChange: true,
  };
  const elementVirtualizer = useVirtualizer({
    ...options,
    getScrollElement: () => scrollRef.current,
  });
  const windowVirtualizer = useWindowVirtualizer({
    ...options,
    getScrollElement: () => window,
  });
  const virtualizer = scrollMode === 'window' ? windowVirtualizer : elementVirtualizer;

  useEffect(() => {
    if (snapshot) virtualizer.scrollToOffset(snapshot.scrollOffset, { align: 'start' });
  }, [snapshot, virtualizer]);

  useEffect(() => {
    if (!onSnapshotChange) return;
    const updateSnapshot = () =>
      onSnapshotChange({
        scrollOffset: virtualizer.scrollOffset ?? 0,
        anchorId: virtualizer.getVirtualItems()[0]?.key?.toString(),
      });
    const element = scrollMode === 'element' ? scrollRef.current : window;
    element?.addEventListener('scroll', updateSnapshot, { passive: true });
    return () => element?.removeEventListener('scroll', updateSnapshot);
  }, [onSnapshotChange, scrollMode, virtualizer]);

  return (
    <div
      ref={scrollRef}
      className={scrollMode === 'element' ? 'h-full overflow-y-auto' : undefined}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
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
