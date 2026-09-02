import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input';
import { Button } from '@/components/ui/button';
import { Square, ArrowUp } from 'lucide-react';

interface ChatComposerProps {
  isLoading: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  canSend?: boolean;
  submitError?: string | null;
  onOpenSettings?: () => void;
}

export function ChatComposer({
  isLoading,
  value,
  onValueChange,
  onSubmit,
  onStop,
  canSend = true,
  submitError = null,
  onOpenSettings,
}: ChatComposerProps) {
  const isDisabled = !isLoading && !canSend;
  const bannerText = submitError ?? (!canSend ? 'Select a model to start chatting' : null);
  const showBanner = Boolean(bannerText);

  const handleSubmit = () => {
    if (isDisabled) {
      onOpenSettings?.();
      return;
    }
    onSubmit();
  };

  return (
    <PromptInput
      value={value}
      onValueChange={onValueChange}
      onSubmit={handleSubmit}
      className="translucent-surface border-border/70 w-full shadow-lg"
    >
      {showBanner && (
        <button
          type="button"
          data-testid="composer-setup-hint"
          onClick={onOpenSettings}
          className="border-border/60 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground mb-2 flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-[background-color,color,transform] duration-(--motion-duration-quick) ease-(--motion-ease-spring) active:scale-[.98]"
        >
          <span>{bannerText}</span>
          <span className="text-[11px] opacity-70">· Open settings</span>
        </button>
      )}
      <PromptInputTextarea placeholder="Ask anything" className="bg-transparent" />
      <PromptInputActions className="justify-end pt-2">
        <PromptInputAction
          tooltip={
            isLoading
              ? 'Stop generation'
              : isDisabled
                ? 'Select a model in Settings'
                : 'Send message'
          }
        >
          <Button
            data-testid="composer-send-button"
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-full disabled:opacity-40"
            onClick={isLoading ? onStop : handleSubmit}
            disabled={!isLoading && isDisabled}
          >
            {isLoading ? (
              <Square className="size-3 fill-current" />
            ) : (
              <ArrowUp className="size-4.5" />
            )}
          </Button>
        </PromptInputAction>
      </PromptInputActions>
    </PromptInput>
  );
}
