import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataControlsPanelProps {
  hasChats: boolean;
  onDeleteAllChats: () => void;
}

export function DataControlsPanel({ hasChats, onDeleteAllChats }: DataControlsPanelProps) {
  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold tracking-tight">Data Controls</h2>
      <div className="mt-8 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <h3 className="text-sm font-semibold">Delete all chats</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Permanently remove all saved conversations and messages.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={!hasChats}
            onClick={onDeleteAllChats}
          >
            <Trash2 />
            Delete All Chats
          </Button>
        </div>
      </div>
    </div>
  );
}
