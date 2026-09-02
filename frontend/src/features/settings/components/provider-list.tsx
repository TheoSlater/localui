import type { TextProvider } from '@/config/settings';

interface ProviderListProps {
  providers: TextProvider[];
  activeProviderId: string;
  apiKeyConfigured: boolean;
  onActiveProviderChange: (id: string) => void;
}

export function providerLabel(provider: TextProvider): string {
  return provider.name.trim() || 'Untitled provider';
}

export function isConfigured(provider: TextProvider, hasApiKey: boolean): boolean {
  return Boolean(provider.baseUrl?.trim() && (provider.type === 'Ollama' || hasApiKey));
}

export function ProviderList({
  providers,
  activeProviderId,
  apiKeyConfigured,
  onActiveProviderChange,
}: ProviderListProps) {
  return (
    <section aria-label="Saved providers" className="min-w-0">
      <div className="flex flex-wrap gap-1.5">
        {providers.map((provider) => {
          const selected = provider.id === activeProviderId;
          const ready = isConfigured(
            provider,
            selected ? apiKeyConfigured : Boolean(provider.hasApiKey),
          );
          return (
            <button
              key={provider.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onActiveProviderChange(provider.id)}
              className={`min-w-0 flex-1 basis-[180px] rounded-md px-3 py-2.5 text-left transition-[background-color,color,transform] duration-(--motion-duration-quick) ease-(--motion-ease-spring) active:scale-[.98] sm:max-w-[240px] ${selected ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${ready ? 'bg-foreground' : 'bg-muted-foreground/40'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-sm font-medium">
                    {providerLabel(provider)}
                  </span>
                  <span className="mt-1 block truncate text-xs">{provider.type}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
