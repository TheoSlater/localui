import { useState, useCallback } from 'react';

export interface ChatMessage {
  id: number;
  role: 'user';
  content: string;
}

export function useChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSubmit = useCallback((content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: 'user', content: trimmedContent },
    ]);
    setIsLoading(false);
  }, []);

  const handleStop = useCallback(() => {
    setIsLoading(false);
  }, []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
  }, []);

  return { messages, isLoading, handleSubmit, handleStop, resetChat };
}
