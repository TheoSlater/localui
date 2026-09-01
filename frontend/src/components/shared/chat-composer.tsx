import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input';
import { Button } from '@/components/ui/button';
import { Square, ArrowUp } from 'lucide-react';
import { useState } from 'react';

interface ChatComposerProps {
  isLoading: boolean;
  onSubmit: (content: string) => void;
  onStop: () => void;
}

export function ChatComposer({ isLoading, onSubmit, onStop }: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const submit = () => {
    if (!draft.trim()) return;
    onSubmit(draft);
    setDraft('');
  };

  return (
    <PromptInput className="border-border/70 bg-background/70 w-full shadow-sm backdrop-blur-md">
      <PromptInputTextarea
        placeholder="Ask anything"
        className="bg-transparent"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <PromptInputActions className="justify-end pt-2">
        <PromptInputAction tooltip={isLoading ? 'Stop generation' : 'Send message'}>
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={isLoading ? onStop : submit}
          >
            {isLoading ? (
              <Square className="size-5 fill-current" />
            ) : (
              <ArrowUp className="size-5" />
            )}
          </Button>
        </PromptInputAction>
      </PromptInputActions>
    </PromptInput>
  );
}
