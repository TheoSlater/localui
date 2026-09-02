import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { fetchAllModels, type ModelItem } from '@/services/models';
import type { TextProvider } from '@/config/settings';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

type Filter = 'all' | 'local' | 'external';

interface ModelSelectorProps {
  providers: TextProvider[];
  activeModel: string;
  onSelect: (providerId: string, modelId: string) => void;
}

export function ModelSelector({ providers, activeModel, onSelect }: ModelSelectorProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const modelsScrollRef = useRef<HTMLDivElement>(null);

  const providersKey = useMemo(
    () => providers.map((p) => `${p.id}:${p.type}:${p.baseUrl}`).join('|'),
    [providers],
  );

  useEffect(() => {
    if (providers.length === 0) return;
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchAllModels(providers).then((items) => {
        if (cancelled) return;
        setModels(items);
        setLoading(false);
      });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [providers, providersKey, open]);

  const filtered = useMemo(() => {
    let list = models;
    if (filter === 'local') list = list.filter((m) => m.origin === 'local');
    if (filter === 'external') list = list.filter((m) => m.origin === 'external');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) => m.id.toLowerCase().includes(q) || m.providerName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [models, filter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ModelItem[]>();
    for (const m of filtered) {
      const key = m.providerName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [filtered]);

  const currentLabel = useMemo(() => {
    const match = models.find((m) => m.id === activeModel);
    return match?.id ?? (activeModel || 'Select model');
  }, [models, activeModel]);

  const rows = useMemo(
    () =>
      Array.from(grouped.entries()).flatMap(([providerName, items]) => [
        { type: 'provider' as const, key: providerName, providerName },
        ...items.map((model) => ({
          type: 'model' as const,
          key: `${model.providerId}-${model.id}`,
          model,
        })),
      ]),
    [grouped],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => modelsScrollRef.current,
    estimateSize: (index) => (rows[index].type === 'provider' ? 28 : 32),
    overscan: 8,
  });

  useLayoutEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => virtualizer.measure());
    return () => cancelAnimationFrame(frame);
  }, [open, rows.length, virtualizer]);

  return (
    <DropdownMenu open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
      <DropdownMenuTrigger
        render={
          <button className="hover:bg-muted hover:text-foreground inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-[background-color,color,transform] duration-(--motion-duration-quick) ease-(--motion-ease-spring) active:scale-[.98]" />
        }
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[420px] rounded-2xl p-0">
        <div className="space-y-2 p-2">
          <div className="bg-muted flex gap-0.5 rounded-md p-0.5">
            {(['all', 'local', 'external'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-[background-color,color,box-shadow] duration-(--motion-duration-quick) ease-(--motion-ease-spring)',
                  filter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search models..."
              autoFocus
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <div
          ref={modelsScrollRef}
          className="max-h-[400px] overflow-y-auto px-1 pb-1"
          style={
            !loading && rows.length > 0
              ? { height: Math.min(400, Math.max(56, rows.length * 32)) }
              : undefined
          }
        >
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading models...
            </div>
          ) : grouped.size === 0 ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              {providers.length === 0 ? 'No providers configured' : 'No models found'}
            </div>
          ) : (
            <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const row = rows[virtualItem.index];
                if (row.type === 'provider') {
                  return (
                    <div
                      key={row.key}
                      ref={virtualizer.measureElement}
                      data-index={virtualItem.index}
                      className="text-muted-foreground absolute top-0 left-0 w-full px-2 py-1.5 text-xs font-medium"
                      style={{ transform: `translateY(${virtualItem.start}px)` }}
                    >
                      {row.providerName}
                    </div>
                  );
                }
                return (
                  <div
                    key={row.key}
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    className="absolute top-0 left-0 w-full"
                    style={{ transform: `translateY(${virtualItem.start}px)` }}
                  >
                    <DropdownMenuItem
                      onClick={() => onSelect(row.model.providerId, row.model.id)}
                      className="flex w-full items-center justify-between"
                    >
                      <span className="truncate font-medium">{row.model.id}</span>
                      <span
                        className={cn(
                          'ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                          row.model.origin === 'local'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                        )}
                      >
                        {row.model.origin === 'local' ? 'Local' : 'External'}
                      </span>
                    </DropdownMenuItem>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
