import { AppLayout } from '@/components/shared/app-layout';
import { ChatWorkspace } from '@/components/shared/chat-workspace';
import { EmptyState } from '@/components/shared/empty-state';
import { ChatComposer } from '@/components/shared/chat-composer';
import { useChat } from '@/hooks/use-chat';
import { useSettingsStore } from '@/stores/settings-store';
import { SettingsDialog } from '@/components/shared/settings-dialog';
import { useState } from 'react';

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { messages, isLoading, handleSubmit, handleStop, resetChat } = useChat();
  const name = useSettingsStore((s) => s.name);
  const bubbleColor = useSettingsStore((s) => s.userBubbleColor);
  const setSettings = useSettingsStore((s) => s.setSettings);

  return (
    <AppLayout
      onNewChat={resetChat}
      onSettings={() => setSettingsOpen(true)}
      bubbleColor={bubbleColor}
      onBubbleColorChange={(userBubbleColor) => setSettings({ userBubbleColor })}
    >
      {messages.length === 0 ? (
        <EmptyState userName={name}>
          <ChatComposer isLoading={isLoading} onSubmit={handleSubmit} onStop={handleStop} />
        </EmptyState>
      ) : (
        <ChatWorkspace
          messages={messages}
          userBubbleColor={bubbleColor}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onStop={handleStop}
        />
      )}
      <SettingsDialog
        open={settingsOpen}
        name={name}
        bubbleColor={bubbleColor}
        onNameChange={(name) => setSettings({ name })}
        onBubbleColorChange={(userBubbleColor) => setSettings({ userBubbleColor })}
        onClose={() => setSettingsOpen(false)}
      />
    </AppLayout>
  );
}

export default App;
