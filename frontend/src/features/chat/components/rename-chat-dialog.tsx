import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Chat } from '@/services/chat';
import { useDialogTransition } from '@/hooks/use-dialog-transition';

export function RenameChatDialog({
  chat,
  onClose,
  onSave,
}: {
  chat?: Chat;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(chat?.title ?? '');
  const { visible, closing, requestClose } = useDialogTransition(undefined, chat);
  useEffect(() => {
    if (chat) setTitle(chat.title);
  }, [chat]);
  if (!chat && !visible) return null;
  const close = () => requestClose(onClose);
  const save = () => {
    if (title.trim()) {
      onSave(title);
      close();
    }
  };
  return (
    <div
      data-closing={closing}
      className={`${closing ? 'opacity-0 duration-(--motion-duration-quick)' : 'animate-in fade-in-0 duration-(--motion-duration-fast)'} fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity ease-(--motion-ease-spring)`}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        data-closing={closing}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-chat-title"
        className={`${closing ? 'scale-[var(--motion-scale-modal)] opacity-0 duration-(--motion-duration-quick)' : 'animate-in fade-in-0 zoom-in-[var(--motion-scale-modal)] duration-(--motion-duration-fast)'} bg-background w-full max-w-md transform-gpu rounded-2xl border p-5 shadow-2xl transition-[opacity,transform] ease-(--motion-ease-spring)`}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="rename-chat-title" className="text-lg font-semibold">
              Rename chat
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">Keep it short and recognizable</p>
          </div>
          <button aria-label="Close" onClick={close}>
            <X className="text-muted-foreground size-4" />
          </button>
        </div>
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Add a title..."
          className="mt-4"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!title.trim()}>
            Save
          </Button>
        </div>
      </section>
    </div>
  );
}
