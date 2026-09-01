import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TextProvider } from '@/config/settings';
import { isConfigured, providerLabel, ProviderList } from '@/components/shared/provider-list';

interface ProviderSettingsPanelProps {
  providers: TextProvider[];
  activeProviderId: string;
  apiKey: string;
  apiKeyConfigured: boolean;
  onProviderChange: (provider: TextProvider) => void;
  onActiveProviderChange: (id: string) => void;
  onApiKeyChange: (key: string) => void;
  onApiKeySave: () => void;
  onApiKeyRemove: () => void;
  onAddProvider: () => void;
  onDeleteProvider: (id: string) => void;
}

const providerTypes: TextProvider['type'][] = [
  'OpenAI',
  'OpenAI-compatible',
  'Anthropic',
  'Google',
  'Ollama',
];

export function ProviderSettingsPanel({
  providers,
  activeProviderId,
  apiKey,
  apiKeyConfigured,
  onProviderChange,
  onActiveProviderChange,
  onApiKeyChange,
  onApiKeySave,
  onApiKeyRemove,
  onAddProvider,
  onDeleteProvider,
}: ProviderSettingsPanelProps) {
  const activeProvider = providers.find((provider) => provider.id === activeProviderId);

  const updateActiveProvider = (changes: Partial<TextProvider>) => {
    if (activeProvider) onProviderChange({ ...activeProvider, ...changes });
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Providers</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Configure models used for chat replies.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAddProvider}>
          <Plus />
          Add provider
        </Button>
      </div>

      <div className="mt-8">
        <ProviderList
          providers={providers}
          activeProviderId={activeProviderId}
          apiKeyConfigured={apiKeyConfigured}
          onActiveProviderChange={onActiveProviderChange}
        />

        {activeProvider ? (
          <div className="border-border/50 mt-6 min-w-0 border-t pt-5">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{providerLabel(activeProvider)}</h3>
              <span className="bg-muted/70 text-muted-foreground animate-in fade-in-0 zoom-in-[var(--motion-scale-tooltip)] inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] leading-4 duration-(--motion-duration-quick)">
                {isConfigured(activeProvider, apiKeyConfigured) ? 'Configured' : 'Needs setup'}
              </span>
            </div>

            <div className="mt-5 max-w-5xl space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="min-w-0 space-y-2">
                  <span className="text-sm font-medium">Name</span>
                  <Input
                    value={activeProvider.name}
                    onChange={(event) => updateActiveProvider({ name: event.target.value })}
                    placeholder="Personal OpenAI"
                    className="h-9 rounded-md"
                  />
                </label>
                <label className="min-w-0 space-y-2">
                  <span className="text-sm font-medium">Provider type</span>
                  <select
                    value={activeProvider.type}
                    onChange={(event) =>
                      updateActiveProvider({ type: event.target.value as TextProvider['type'] })
                    }
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-2.5 text-sm outline-none focus-visible:ring-3"
                  >
                    {providerTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Base URL</span>
                <Input
                  value={activeProvider.baseUrl}
                  onChange={(event) => updateActiveProvider({ baseUrl: event.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="h-9 rounded-md"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Model</span>
                <Input
                  value={activeProvider.model}
                  onChange={(event) => updateActiveProvider({ model: event.target.value })}
                  placeholder="Model name"
                  className="h-9 rounded-md"
                />
              </label>

              <div className="border-t pt-5">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">API key</span>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(event) => onApiKeyChange(event.target.value)}
                    placeholder={apiKeyConfigured ? 'Replace API key' : 'Paste an API key'}
                    className="h-9 rounded-md"
                  />
                </label>
                {apiKeyConfigured && (
                  <div className="text-muted-foreground animate-in fade-in-0 mt-2 flex items-center gap-2 text-xs duration-(--motion-duration-quick)">
                    <span className="bg-foreground/60 size-1.5 rounded-full transition-colors duration-(--motion-duration-quick)" />
                    <span>API key configured</span>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={apiKey.trim() ? 'default' : 'ghost'}
                    onClick={onApiKeySave}
                    disabled={!apiKey.trim()}
                  >
                    Save API key
                  </Button>
                  {apiKeyConfigured && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onApiKeyRemove}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Remove key
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {providers.length > 1 && (
              <div className="mt-7 flex justify-end border-t pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteProvider(activeProvider.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                  Remove provider
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground py-4 text-sm">
            No providers yet.{' '}
            <button
              type="button"
              onClick={onAddProvider}
              className="text-foreground underline-offset-4 hover:underline"
            >
              Add one
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
