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
}

export function ChatComposer({
  isLoading,
  value,
  onValueChange,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  return (
    <PromptInput
      value={value}
      onValueChange={onValueChange}
      onSubmit={onSubmit}
      className="border-border/70 bg-background w-full shadow-sm"
    >
      <PromptInputTextarea placeholder="Ask anything" className="bg-transparent" />
      <PromptInputActions className="justify-end pt-2">
        <PromptInputAction tooltip={isLoading ? 'Stop generation' : 'Send message'}>
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={isLoading ? onStop : onSubmit}
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
