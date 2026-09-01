import { ChatComposer } from '@/components/shared/chat-composer';
import type { ChatMessage } from '@/hooks/use-chat';
import { VirtualMessageList } from '@/components/shared/virtual-message-list';

function getBubbleTextColor(hex: string) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? '#17121f' : '#ffffff';
}

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  userBubbleColor: string;
  isLoading: boolean;
  onSubmit: (content: string) => void;
  onStop: () => void;
}

export function ChatWorkspace({
  messages,
  userBubbleColor,
  isLoading,
  onSubmit,
  onStop,
}: ChatWorkspaceProps) {
  return (
    <div className="relative flex h-svh max-h-svh min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 px-4 py-16 pb-44">
        <VirtualMessageList
          items={messages}
          getItemKey={(message) => message.id}
          renderItem={(message) => (
            <div className="mx-auto flex w-full max-w-2xl justify-end pb-5">
              <div
                className="max-w-[80%] rounded-[20px] rounded-br-sm px-4 py-2.5 text-[15px] leading-6 shadow-sm"
                style={{
                  backgroundColor: userBubbleColor,
                  color: getBubbleTextColor(userBubbleColor),
                }}
              >
                {message.content}
              </div>
            </div>
          )}
        />
      </div>
      <div className="from-background via-background/90 pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t to-transparent px-4 pt-8 pb-6">
        <div className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3">
          <ChatComposer isLoading={isLoading} onSubmit={onSubmit} onStop={onStop} />
        </div>
      </div>
    </div>
  );
}
