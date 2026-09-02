import { useMemo, useState } from 'react';
import { ArrowLeft, Check, KeyRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isCompleteHttpUrl, type TextProvider } from '@/config/settings';
import { getUserFacingError } from '@/lib/error-message';
import { providerFromPreset, providerPresets, type ProviderPreset } from '../provider-presets';

type WizardProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (provider: TextProvider, key: string) => Promise<void>;
};

export function AddProviderWizard({ open, onClose, onComplete }: WizardProps) {
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
      .then(onClose)
      .catch((error) => setError(getUserFacingError(error, 'Unable to add provider.')))
      .finally(() => setSaving(false));
  };
  const back = () => {
    setError('');
    setStep(Math.max(0, step - 1));
  };
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        resize
        className="bg-background text-foreground w-full max-w-[560px] gap-0 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:!max-w-[560px]"
      >
        <DialogHeader className="flex-row items-start justify-between border-b px-6 py-5">
          <div>
            <DialogTitle className="text-lg font-semibold">
              {step === 0 ? 'Add a provider' : step === 3 ? 'Ready to add' : preset?.name}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {step === 0
                ? 'Choose a provider to connect.'
                : step === 3
                  ? 'Review connection details before saving.'
                  : 'Connect this provider to your workspace.'}
            </DialogDescription>
          </div>
          <DialogClose render={<Button variant="ghost" size="icon-sm" aria-label="Close" />}>
            <X />
          </DialogClose>
        </DialogHeader>
        <div key={step} className="provider-wizard-step p-6">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {providerPresets
                .filter((p) => p.id !== 'custom')
                .map((p) => (
                  <Button
                    type="button"
                    variant="outline"
                    key={p.id}
                    onClick={() => choose(p)}
                    className="h-auto justify-start px-3 py-4 text-left"
                  >
                    {p.name}
                  </Button>
                ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => choose(providerPresets.find((p) => p.id === 'custom')!)}
                className="col-span-2 h-auto justify-start border-dashed px-3 py-4 text-left sm:col-span-3"
              >
                Custom OpenAI-compatible
              </Button>
            </div>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              {custom && (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Name</span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My provider"
                  />
                </label>
              )}
              {needsEndpoint && (
                <label className="flex flex-col gap-2">
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
                <div className="flex flex-col gap-3">
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
            <div className="flex flex-col gap-3">
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
            <div className="flex flex-col gap-4 text-sm">
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
        <DialogFooter className="flex-row items-center justify-between px-6 py-4">
          <Button variant="ghost" onClick={step ? back : onClose}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
