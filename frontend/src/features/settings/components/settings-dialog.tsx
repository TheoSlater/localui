import { Database, Search, Server, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { TextProvider } from '@/config/settings';
import { ProviderSettingsPanel } from './provider-settings-panel';
import { DataControlsPanel } from './data-controls-panel';
import { useDialogTransition } from '@/hooks/use-dialog-transition';

const settingsSections = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'providers', label: 'Providers', icon: Server },
  { id: 'data-controls', label: 'Data Controls', icon: Database },
] as const;

type SettingsSection = (typeof settingsSections)[number]['id'];

interface SettingsDialogProps {
  open: boolean;
  name: string;
  bubbleColor: string;
  onNameChange: (name: string) => void;
  onBubbleColorChange: (color: string) => void;
  onClose: () => void;
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
  hasChats: boolean;
  onDeleteAllChats: () => void;
}

export function SettingsDialog({
  open,
  name,
  bubbleColor,
  onNameChange,
  onBubbleColorChange,
  onClose,
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
  hasChats,
  onDeleteAllChats,
}: SettingsDialogProps) {
  const { visible, closing, requestClose } = useDialogTransition(open);
  const [section, setSection] = useState<SettingsSection>('providers');
  const [settingsSearch, setSettingsSearch] = useState('');

  const normalizedSearch = settingsSearch.trim().toLowerCase();
  const visibleSections = settingsSections.filter((item) =>
    item.label.toLowerCase().includes(normalizedSearch),
  );

  useEffect(() => {
    if (open) setSettingsSearch('');
  }, [open]);

  const close = () => requestClose(onClose);

  if (!visible) return null;

  return (
    <div
      className={`${closing ? 'opacity-0 duration-(--motion-duration-quick)' : 'animate-in fade-in-0 duration-(--motion-duration-fast)'} fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 transition-opacity ease-(--motion-ease-spring) sm:p-6`}
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className={`${closing ? 'scale-[var(--motion-scale-modal)] opacity-0 duration-(--motion-duration-quick)' : 'animate-in fade-in-0 zoom-in-[var(--motion-scale-modal)] duration-(--motion-duration-fast)'} bg-background border-border/50 grid h-[min(88vh,760px)] max-h-[calc(100vh-2rem)] w-[min(92vw,1160px)] max-w-[calc(100vw-1.5rem)] transform-gpu grid-rows-[4.25rem_minmax(0,1fr)] overflow-hidden rounded-2xl border shadow-2xl transition-[opacity,transform] ease-(--motion-ease-spring)`}
      >
        <header className="flex items-center justify-between px-5 sm:px-8">
          <h1 id="settings-title" className="text-lg font-semibold tracking-tight">
            Settings
          </h1>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close settings">
            <X />
          </Button>
        </header>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[196px_minmax(0,1fr)] md:grid-rows-1">
          <aside className="bg-background border-border/50 shrink-0 border-b px-3 pb-3 md:border-b-0 md:px-4 md:py-4">
            <div className="relative mb-3">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                aria-label="Search settings"
                value={settingsSearch}
                onChange={(event) => setSettingsSearch(event.target.value)}
                placeholder="Search"
                className="bg-background/50 h-8 rounded-md pl-8 text-xs"
              />
            </div>
            <nav aria-label="Settings sections" className="flex gap-1 md:flex-col">
              {visibleSections.map(({ id, label, icon: Icon }) => (
                <SectionButton
                  key={id}
                  label={label}
                  active={section === id}
                  icon={<Icon />}
                  onClick={() => setSection(id)}
                />
              ))}
            </nav>
          </aside>

          <main className="min-h-0 min-w-0 [scrollbar-gutter:stable] overflow-y-auto px-5 pt-6 pb-7 sm:px-8 sm:pt-7 sm:pb-8 lg:px-10">
            {section === 'providers' ? (
              <ProviderSettingsPanel
                providers={providers}
                activeProviderId={activeProviderId}
                apiKey={apiKey}
                apiKeyConfigured={apiKeyConfigured}
                onProviderChange={onProviderChange}
                onActiveProviderChange={onActiveProviderChange}
                onApiKeyChange={onApiKeyChange}
                onApiKeySave={onApiKeySave}
                onApiKeyRemove={onApiKeyRemove}
                onAddProvider={onAddProvider}
                onDeleteProvider={onDeleteProvider}
              />
            ) : section === 'data-controls' ? (
              <DataControlsPanel hasChats={hasChats} onDeleteAllChats={onDeleteAllChats} />
            ) : (
              <GeneralSettings
                name={name}
                bubbleColor={bubbleColor}
                onNameChange={onNameChange}
                onBubbleColorChange={onBubbleColorChange}
              />
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

function SectionButton({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-[background-color,color,transform] duration-(--motion-duration-quick) ease-(--motion-ease-spring) active:scale-[.98] md:w-full md:flex-none ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
    >
      <span className="shrink-0 [&_svg]:size-4">{icon}</span>
      <span className="truncate font-medium">{label}</span>
    </button>
  );
}

function GeneralSettings({
  name,
  bubbleColor,
  onNameChange,
  onBubbleColorChange,
}: {
  name: string;
  bubbleColor: string;
  onNameChange: (name: string) => void;
  onBubbleColorChange: (color: string) => void;
}) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold tracking-tight">General</h2>
      <div className="mt-8 space-y-8">
        <label className="block max-w-md space-y-2">
          <span className="text-sm font-medium">Your name</span>
          <Input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="There"
            className="h-9 rounded-md"
          />
        </label>
        <section className="border-t pt-6">
          <h3 className="text-sm font-semibold">Appearance</h3>
          <div className="mt-5 space-y-5">
            <div className="flex max-w-md items-center justify-between gap-6">
              <span className="text-sm font-medium">Theme</span>
              <ThemeToggle />
            </div>
            <label className="flex max-w-md items-center justify-between gap-6">
              <span className="text-sm font-medium">User bubble color</span>
              <input
                aria-label="User bubble color"
                type="color"
                value={bubbleColor}
                onChange={(event) => onBubbleColorChange(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border-0 bg-transparent p-0"
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
