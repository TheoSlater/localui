import * as React from 'react';
import { Ellipsis, Plus, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Chat } from '@/services/chat';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onNewChat?: () => void;
  onSettings?: () => void;
  chats?: Chat[];
  selectedChatId?: string;
  onSelectChat?: (id: string) => void;
  onRenameChat?: (chat: Chat) => void;
  onDeleteChat?: (id: string) => void;
}

export function AppSidebar({
  onNewChat,
  onSettings,
  chats = [],
  selectedChatId,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="shrink-0 p-2">
        <div className="flex h-8 items-center justify-between px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">Chat</span>
          <SidebarTrigger className="size-8" />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="New Chat" onClick={onNewChat}>
              <Plus />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="min-h-0 transition-[opacity,transform] duration-(--motion-duration-fast) ease-(--motion-ease-spring) group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:translate-x-[-4px] group-data-[collapsible=icon]:opacity-0">
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel>Recent chats</SidebarGroupLabel>
          <SidebarMenu>
            {chats.map((chat) => (
              <SidebarMenuItem key={chat.id} className="group/chat">
                <SidebarMenuButton
                  isActive={chat.id === selectedChatId}
                  onClick={() => onSelectChat?.(chat.id)}
                >
                  <span className="truncate">{chat.title}</span>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        aria-label={`Actions for ${chat.title}`}
                        className="text-muted-foreground hover:bg-accent invisible absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/chat:visible group-hover/chat:opacity-100 focus-visible:visible focus-visible:opacity-100"
                      />
                    }
                  >
                    <Ellipsis className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onRenameChat?.(chat)}>Rename</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => onDeleteChat?.(chat.id)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto shrink-0 border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" onClick={onSettings}>
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
