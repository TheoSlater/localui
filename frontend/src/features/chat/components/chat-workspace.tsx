import { memo, useCallback, useMemo, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatComposer } from './chat-composer';
import type { ChatMessage } from '@/stores/chat-store';
import { VirtualMessageList } from '@/components/shared/virtual-message-list';
import { StreamingMarkdown, TechnicalContent } from './technical-content';
import { ThinkingReasoning } from './thinking-reasoning';

function getBubbleTextColor(hex: string) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? '#17121f' : '#ffffff';
}

const MessageBubble = memo(function MessageBubble({
  message,
  userBubbleColor,
  userTextColor,
}: {
  message: ChatMessage;
  userBubbleColor: string;
  userTextColor: string;
}) {
  return (
    <div
      className={`mx-auto flex w-full max-w-2xl pb-7 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`text-[15px] leading-6 whitespace-pre-wrap ${message.role === 'user' ? 'max-w-[80%] rounded-[20px] px-4 py-2.5 shadow-sm' : 'w-full'}`}
        style={
          message.role === 'user'
            ? {
                backgroundColor: userBubbleColor,
                color: userTextColor,
              }
            : undefined
        }
      >
        {message.role === 'assistant' && (message.streaming || message.reasoning) && (
          <ThinkingReasoning reasoning={message.reasoning} streaming={message.streaming} />
        )}
        {message.role === 'assistant' && message.streaming ? (
          <StreamingMarkdown content={message.content} streaming={true} />
        ) : (
          <TechnicalContent content={message.content} streaming={false} />
        )}
      </div>
    </div>
  );
});

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  userBubbleColor: string;
  isLoading: boolean;
  onSubmit: () => void;
  onStop: () => void;
  input: string;
  onValueChange: (value: string) => void;
  canSend?: boolean;
  submitError?: string | null;
  onOpenSettings?: () => void;
}

export function ChatWorkspace({
  messages,
  userBubbleColor,
  isLoading,
  onSubmit,
  onStop,
  input,
  onValueChange,
  canSend = true,
  submitError = null,
  onOpenSettings,
}: ChatWorkspaceProps) {
  const userTextColor = useMemo(() => getBubbleTextColor(userBubbleColor), [userBubbleColor]);
  const [atBottom, setAtBottom] = useState(true);
  const [scrollToBottomRequest, setScrollToBottomRequest] = useState(0);
  const getItemKey = useCallback((m: ChatMessage) => m.id, []);
  const renderItem = useCallback(
    (message: ChatMessage) => (
      <MessageBubble
        message={message}
        userBubbleColor={userBubbleColor}
        userTextColor={userTextColor}
      />
    ),
    [userBubbleColor, userTextColor],
  );

  return (
    <div className="relative flex h-svh max-h-svh min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 px-4 pt-14">
        <VirtualMessageList
          items={messages}
          getItemKey={getItemKey}
          renderItem={renderItem}
          autoScroll={isLoading && atBottom}
          scrollToBottomRequest={scrollToBottomRequest}
          onAtBottomChange={setAtBottom}
          bottomPadding={256}
        />
      </div>
      {!atBottom && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Scroll to bottom"
          onClick={() => setScrollToBottomRequest((value) => value + 1)}
          className="border-border/70 bg-background/60 absolute bottom-40 left-1/2 z-20 -translate-x-1/2 rounded-full shadow-sm backdrop-blur-md"
        >
          <ArrowDown />
        </Button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pt-14 pb-6">
        <div className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3">
          <ChatComposer
            value={input}
            onValueChange={onValueChange}
            isLoading={isLoading}
            onSubmit={onSubmit}
            onStop={onStop}
            canSend={canSend}
            submitError={submitError}
            onOpenSettings={onOpenSettings}
          />
        </div>
      </div>
    </div>
  );
}
