import { useMemo, useState } from 'react';
import { ArrowLeft, Check, KeyRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isCompleteHttpUrl, type TextProvider } from '@/config/settings';
import { providerFromPreset, providerPresets, type ProviderPreset } from '../provider-presets';
import { useDialogTransition } from '@/hooks/use-dialog-transition';

type WizardProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (provider: TextProvider, key: string) => Promise<void>;
};

export function AddProviderWizard({ open, onClose, onComplete }: WizardProps) {
  const { visible, closing, requestClose } = useDialogTransition(open);
  const [preset, setPreset] = useState<ProviderPreset>();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const standard = preset?.kind === 'preset' && preset.id !== 'ollama';
  const custom = preset?.kind === 'custom';
  const needsEndpoint = Boolean(custom || preset?.id === 'ollama');

  const endpoint = useMemo(() => baseUrl || preset?.defaultBaseUrl || '', [baseUrl, preset]);
  if (!visible) return null;
  const close = () => requestClose(onClose);
  const choose = (next: ProviderPreset) => {
    setPreset(next);
    setName(next.name);
    setBaseUrl(next.defaultBaseUrl ?? '');
    setApiKey('');
    setError('');
    setStep(1);
  };
  const continueStep = () => {
    setError('');
    if (!preset) return;
    if (step === 1 && custom && (!name.trim() || !isCompleteHttpUrl(endpoint)))
      return setError('Enter a name and complete http or https API URL.');
    if (step === 1 && needsEndpoint && !isCompleteHttpUrl(endpoint))
      return setError('Enter a complete http or https URL.');
    if (step === 1 && custom) return setStep(2);
    if (step === 1 || step === 2) return setStep(3);
    setSaving(true);
    void onComplete(providerFromPreset(preset, name.trim() || preset.name, endpoint), apiKey.trim())
      .then(close)
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to add provider.'))
      .finally(() => setSaving(false));
  };
  const back = () => {
    setError('');
    setStep(Math.max(0, step - 1));
  };
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        role="dialog"
        aria-modal="true"
        className={`${closing ? 'scale-[var(--motion-scale-modal)] opacity-0 duration-(--motion-duration-quick)' : 'animate-in fade-in-0 zoom-in-[var(--motion-scale-modal)] duration-(--motion-duration-fast)'} bg-background border-border/60 w-full max-w-[560px] overflow-hidden rounded-2xl border shadow-2xl transition-[opacity,transform] ease-(--motion-ease-spring)`}
      >
        <header className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">
              {step === 0 ? 'Add a provider' : step === 3 ? 'Ready to add' : preset?.name}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {step === 0
                ? 'Choose a provider to connect.'
                : step === 3
                  ? 'Review connection details before saving.'
                  : 'Connect this provider to your workspace.'}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
            <X />
          </Button>
        </header>
        <div key={step} className="provider-wizard-step p-6">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {providerPresets
                .filter((p) => p.id !== 'custom')
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => choose(p)}
                    className="border-border/70 hover:bg-muted/60 rounded-xl border px-3 py-4 text-left text-sm font-medium transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              <button
                onClick={() => choose(providerPresets.find((p) => p.id === 'custom')!)}
                className="border-border/70 hover:bg-muted/60 col-span-2 rounded-xl border border-dashed px-3 py-4 text-left text-sm font-medium sm:col-span-3"
              >
                Custom OpenAI-compatible
              </button>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              {custom && (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Name</span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My provider"
                  />
                </label>
              )}
              {needsEndpoint && (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">
                    {preset?.id === 'ollama' ? 'Server URL' : 'API URL'}
                  </span>
                  <Input
                    value={endpoint}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://example.com/v1"
                  />
                </label>
              )}
              {standard && (
                <div className="space-y-3">
                  <div className="bg-muted/50 flex items-center gap-3 rounded-xl p-4">
                    <KeyRound className="text-muted-foreground size-4" />
                    <p className="text-sm">Your key is stored securely in your system keychain.</p>
                  </div>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste API key"
                  />
                </div>
              )}
              {preset?.id === 'ollama' && (
                <p className="text-muted-foreground text-sm">
                  Ollama normally runs without an API key.
                </p>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <label className="text-sm font-medium">
                API key <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste API key"
              />
              <p className="text-muted-foreground text-xs">
                Leave empty if endpoint does not require one.
              </p>
            </div>
          )}
          {step === 3 && preset && (
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground">Provider</span>
                <p className="font-medium">{name || preset.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Type</span>
                <p>{preset.providerType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Endpoint</span>
                <p className="truncate">{endpoint || 'Provider default'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">API key</span>
                <p>{apiKey.trim() ? 'Configured' : 'Not required / not configured'}</p>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-destructive mt-4 text-sm">
              {error}
            </p>
          )}
        </div>
        <footer className="bg-muted/20 flex items-center justify-between border-t px-6 py-4">
          <Button variant="ghost" onClick={step ? back : close}>
            {step ? (
              <>
                <ArrowLeft />
                Back
              </>
            ) : (
              'Cancel'
            )}
          </Button>
          {step > 0 && (
            <Button onClick={continueStep} disabled={saving || (standard && !apiKey.trim())}>
              {saving ? (
                'Adding…'
              ) : step === 3 ? (
                <>
                  <Check />
                  Add provider
                </>
              ) : (
                'Continue'
              )}
            </Button>
          )}
        </footer>
      </section>
    </div>
  );
}
