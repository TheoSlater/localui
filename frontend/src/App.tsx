import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/shared/app-sidebar';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from './components/ui/prompt-input';
import { Button } from './components/ui/button';
import { Square, ArrowUp } from 'lucide-react';
import { useState } from 'react';

function App() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
  };

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset className="relative min-h-svh">
        <div className="absolute top-2 right-2">
          <ThemeToggle />
        </div>

        <div className="flex min-h-svh items-center justify-center p-4">
          <PromptInput className="bg-background w-full max-w-2xl">
            <PromptInputTextarea placeholder="Ask anything" className="bg-transparent" />

            <PromptInputActions className="justify-end pt-2">
              <PromptInputAction tooltip={isLoading ? 'Stop generation' : 'Send message'}>
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={handleSubmit}
                >
                  {isLoading ? (
                    <Square className="size-5 fill-current" />
                  ) : (
                    <ArrowUp className="size-5" />
                  )}
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
