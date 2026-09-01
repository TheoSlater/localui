import { ChatComposer } from '@/components/shared/chat-composer';
import type { ChatMessage } from '@/stores/chat-store';
import { VirtualMessageList } from '@/components/shared/virtual-message-list';
import { TechnicalContent } from '@/components/shared/technical-content';
import { ThinkingReasoning } from '@/ThinkingReasoning';

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
  onSubmit: () => void;
  onStop: () => void;
  input: string;
  onValueChange: (value: string) => void;
}

export function ChatWorkspace({
  messages,
  userBubbleColor,
  isLoading,
  onSubmit,
  onStop,
  input,
  onValueChange,
}: ChatWorkspaceProps) {
  return (
    <div className="animate-in fade-in-0 relative flex h-svh max-h-svh min-h-0 flex-col overflow-hidden duration-(--motion-duration-fast) ease-(--motion-ease-spring)">
      <div className="min-h-0 flex-1 px-4 pt-14 pb-44">
        <VirtualMessageList
          items={messages}
          getItemKey={(message) => message.id}
          renderItem={(message) => (
            <div
              className={`animate-in fade-in-0 zoom-in-[var(--motion-scale-tooltip)] slide-in-from-bottom-1 mx-auto flex w-full max-w-2xl pb-7 duration-(--motion-duration-fast) ease-(--motion-ease-spring) ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`text-[15px] leading-6 whitespace-pre-wrap ${message.role === 'user' ? 'max-w-[80%] rounded-[20px] px-4 py-2.5 shadow-sm' : 'w-full'}`}
                style={
                  message.role === 'user'
                    ? {
                        backgroundColor: userBubbleColor,
                        color: getBubbleTextColor(userBubbleColor),
                      }
                    : undefined
                }
              >
                {message.role === 'assistant' && (message.streaming || message.reasoning) && (
                  <ThinkingReasoning reasoning={message.reasoning} streaming={message.streaming} />
                )}
                <TechnicalContent content={message.content} streaming={message.streaming} />
              </div>
            </div>
          )}
        />
      </div>
      <div className="from-background via-background/90 pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t to-transparent px-4 pt-8 pb-6">
        <div className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3">
          <ChatComposer
            value={input}
            onValueChange={onValueChange}
            isLoading={isLoading}
            onSubmit={onSubmit}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
}
