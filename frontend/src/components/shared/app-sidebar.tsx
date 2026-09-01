import * as React from 'react';
import { Plus } from 'lucide-react';

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-2">
        <SidebarMenu className="gap-2">
          <SidebarMenuItem>
            <div className="flex h-8 items-center justify-between px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">
                LocalUI
              </span>

              <SidebarTrigger className="size-8" />
            </div>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton tooltip="New Chat">
              <Plus />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
    </Sidebar>
  );
}
