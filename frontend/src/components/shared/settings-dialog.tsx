import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { useEffect, useState } from 'react';

interface SettingsDialogProps {
  open: boolean;
  name: string;
  bubbleColor: string;
  onNameChange: (name: string) => void;
  onBubbleColorChange: (color: string) => void;
  onClose: () => void;
}

export function SettingsDialog({
  open,
  name,
  bubbleColor,
  onNameChange,
  onBubbleColorChange,
  onClose,
}: SettingsDialogProps) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
    }
  }, [open]);

  const close = () => {
    setClosing(true);
    window.setTimeout(() => {
      setVisible(false);
      onClose();
    }, 180);
  };

  if (!visible) return null;

  return (
    <div
      className={`${closing ? 'animate-out fade-out-0' : 'animate-in fade-in-0'} fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm duration-200`}
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className={`${closing ? 'animate-out fade-out-0 zoom-out-95' : 'animate-in fade-in-0 zoom-in-95'} bg-background flex h-[min(520px,calc(100vh-2rem))] w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl duration-200`}
      >
        <aside className="bg-muted/30 hidden w-48 shrink-0 border-r p-3 sm:block">
          <p className="px-3 py-2 text-sm font-semibold">Settings</p>
          <button className="bg-accent mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-medium">
            General
          </button>
          <button className="text-muted-foreground hover:bg-accent hover:text-foreground w-full rounded-lg px-3 py-2 text-left text-sm">
            Appearance
          </button>
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 id="settings-title" className="text-xl font-semibold tracking-tight">
                General
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Personalize your local workspace.
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close settings">
              <X />
            </Button>
          </div>
          <div className="mt-8 space-y-6">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Your name</span>
              <Input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="There"
              />
            </label>
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium">Appearance</h3>
              <p className="text-muted-foreground mt-1 text-sm">Choose how LocalUI looks.</p>
              <div className="mt-4">
                <ThemeToggle />
              </div>
            </div>
            <label className="flex items-center justify-between border-t pt-6">
              <div>
                <span className="text-sm font-medium">User bubble color</span>
                <p className="text-muted-foreground mt-1 text-sm">Used for your messages.</p>
              </div>
              <input
                aria-label="User bubble color"
                type="color"
                value={bubbleColor}
                onChange={(event) => onBubbleColorChange(event.target.value)}
                className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
