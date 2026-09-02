import { memo, useCallback, useMemo, useState } from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';
import { Check, Copy } from 'lucide';
import { MorphIcon } from 'morphicons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChatComposer } from './chat-composer';
import { useChatStore, type ChatMessage } from '@/stores/chat-store';
import { VirtualMessageList } from '@/components/shared/virtual-message-list';
import { StreamingMarkdown, TechnicalContent } from './technical-content';
import { ThinkingReasoning } from './thinking-reasoning';
import { notifications } from '@/services/notifications';
import { getUserFacingError } from '@/lib/error-message';

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
  isLatestAssistant,
  onRegenerate,
}: {
  message: ChatMessage;
  userBubbleColor: string;
  userTextColor: string;
  isLatestAssistant: boolean;
  onRegenerate: (messageId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyText = useCallback(() => {
    void navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopied(true);
        notifications.success('Copied', 'Message text copied to the clipboard.');
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch((error) =>
        notifications.error(
          'Unable to copy',
          getUserFacingError(error, 'Could not copy message text.'),
        ),
      );
  }, [message.content]);

  return (
    <div
      className={`group/message mx-auto flex w-full max-w-2xl flex-col pb-7 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
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
      {message.content && (!message.streaming || message.role === 'user') && (
        <TooltipProvider delay={300}>
          <div
            className="message-actions mt-1 flex w-fit items-center justify-start gap-1"
            data-latest={isLatestAssistant}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copied ? 'Copied' : 'Copy text'}
                    onClick={copyText}
                    className="text-muted-foreground hover:text-foreground"
                  />
                }
              >
                <MorphIcon
                  icon={copied ? Check : Copy}
                  size={16}
                  strokeWidth={2}
                  reducedMotion="user"
                  spring="snappy"
                  className={copied ? 'text-emerald-500' : undefined}
                />
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied' : 'Copy text'}</TooltipContent>
            </Tooltip>
            {message.role === 'assistant' && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Regenerate"
                      onClick={() => onRegenerate(message.id)}
                      className="text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  <RefreshCw />
                </TooltipTrigger>
                <TooltipContent>Regenerate</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      )}
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
  const regenerateMessage = useChatStore((s) => s.regenerateMessage);
  const userTextColor = useMemo(() => getBubbleTextColor(userBubbleColor), [userBubbleColor]);
  const [atBottom, setAtBottom] = useState(true);
  const [scrollToBottomRequest, setScrollToBottomRequest] = useState(0);
  const getItemKey = useCallback((m: ChatMessage) => m.id, []);
  const latestAssistantId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'assistant' && !message.streaming && message.content) return message.id;
    }
    return undefined;
  }, [messages]);
  const renderItem = useCallback(
    (message: ChatMessage) => (
      <MessageBubble
        message={message}
        userBubbleColor={userBubbleColor}
        userTextColor={userTextColor}
        isLatestAssistant={message.id === latestAssistantId}
        onRegenerate={(messageId) =>
          void regenerateMessage(messageId).catch((error) =>
            notifications.error(
              'Unable to regenerate',
              getUserFacingError(error, 'Could not regenerate this response.'),
            ),
          )
        }
      />
    ),
    [latestAssistantId, regenerateMessage, userBubbleColor, userTextColor],
  );
  const handleSubmit = useCallback(() => {
    setScrollToBottomRequest((value) => value + 1);
    onSubmit();
  }, [onSubmit]);

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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pt-14 pb-6">
        <div className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3">
          {!atBottom && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Scroll to bottom"
              onClick={() => setScrollToBottomRequest((value) => value + 1)}
              className="translucent-surface border-border/70 mx-auto rounded-full shadow-sm"
            >
              <ArrowDown />
            </Button>
          )}
          <ChatComposer
            value={input}
            onValueChange={onValueChange}
            isLoading={isLoading}
            onSubmit={handleSubmit}
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
