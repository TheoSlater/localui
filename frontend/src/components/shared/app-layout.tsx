import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/shared/app-sidebar';
import { ThemeToggle } from '@/components/shared/theme-toggle';

interface AppLayoutProps {
  children: React.ReactNode;
  onNewChat?: () => void;
  bubbleColor: string;
  onBubbleColorChange: (color: string) => void;
  onSettings?: () => void;
}

export function AppLayout({
  children,
  onNewChat,
  bubbleColor,
  onBubbleColorChange,
  onSettings,
}: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar onNewChat={onNewChat} onSettings={onSettings} />
      <SidebarInset className="relative min-h-svh">
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <ThemeToggle />
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
