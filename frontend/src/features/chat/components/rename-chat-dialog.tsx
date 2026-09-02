import { useEffect, useState } from 'react';
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
import type { Chat } from '@/services/chat';

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
  useEffect(() => {
    if (chat) setTitle(chat.title);
  }, [chat]);
  const save = () => {
    if (title.trim()) {
      onSave(title);
      onClose();
    }
  };
  return (
    <Dialog open={Boolean(chat)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
          <DialogDescription>Keep it short and recognizable.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Add a title..."
          className="mt-1"
        />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={save} disabled={!title.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
