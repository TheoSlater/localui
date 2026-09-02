import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { ModelSelector } from '@/features/settings/components/model-selector';
import type { TextProvider } from '@/config/settings';
import type { Chat } from '@/services/chat';

interface AppLayoutProps {
  children: React.ReactNode;
  providers: TextProvider[];
  activeModel: string;
  onModelSelect: (providerId: string, modelId: string) => void;
  onNewChat?: () => void;
  onSettings?: () => void;
  chats?: Chat[];
  selectedChatId?: string;
  onSelectChat?: (id: string) => void;
  onRenameChat?: (chat: Chat) => void;
  onDeleteChat?: (id: string) => void;
}

export function AppLayout({
  children,
  onNewChat,
  providers,
  activeModel,
  onModelSelect,
  onSettings,
  chats,
  selectedChatId,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
}: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar
        onNewChat={onNewChat}
        onSettings={onSettings}
        chats={chats}
        selectedChatId={selectedChatId}
        onSelectChat={onSelectChat}
        onRenameChat={onRenameChat}
        onDeleteChat={onDeleteChat}
      />
      <SidebarInset className="relative min-h-svh">
        <header className="pointer-events-none absolute inset-x-0 top-2 z-20 flex items-center justify-between px-2">
          <div className="pointer-events-auto">
            <ModelSelector
              providers={providers}
              activeModel={activeModel}
              onSelect={onModelSelect}
            />
          </div>
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
