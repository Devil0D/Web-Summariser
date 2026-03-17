"use client";
import { useAuth } from "@/context/AuthContext";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Folder,
  Share,
} from "lucide-react";

export const NavHistory = () => {
  const {
    conversations,
    selectConversation,
    activeConversationId,
    deleteConversation,
  } = useAuth();

  if (!conversations || conversations.length === 0) return null;

  const { isMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[#b0a090] text-xs font-semibold uppercase tracking-wider">
        History
      </SidebarGroupLabel>
      <SidebarMenu>
        {conversations.map((convo) => (
          <SidebarMenuItem key={convo.ID}>
            <div className="flex items-center w-full group/history">
              <SidebarMenuButton
                onClick={() => selectConversation(convo.ID)}
                isActive={activeConversationId === convo.ID}
                className="flex-1 truncate rounded-xl text-[#7c6d5e] hover:bg-[#f0ebe4] hover:text-[#3d3530]
                  data-[active=true]:bg-[#f0ebe4] data-[active=true]:text-[#c4956a] transition-colors"
              >
                <MessageSquare className="size-3.5 flex-shrink-0" />
                <span className="truncate text-sm">{convo.title}</span>
              </SidebarMenuButton>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction
                    showOnHover
                    className="rounded-lg text-[#b0a090] hover:text-[#7c6d5e] hover:bg-[#f0ebe4] transition-colors"
                  >
                    <MoreHorizontal className="size-3.5" />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-44 rounded-xl p-1"
                  style={{
                    background: "#fdfaf7",
                    border: "1px solid #e0d8ce",
                    boxShadow: "0 6px 20px rgba(100,80,60,0.12)",
                  }}
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem className="rounded-lg cursor-pointer text-[#7c6d5e] hover:bg-[#f0ebe4] focus:bg-[#f0ebe4] text-sm">
                    <Folder className="mr-2 h-3.5 w-3.5 text-[#b0a090]" />
                    View Project
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-lg cursor-pointer text-[#7c6d5e] hover:bg-[#f0ebe4] focus:bg-[#f0ebe4] text-sm">
                    <Share className="mr-2 h-3.5 w-3.5 text-[#b0a090]" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator style={{ background: "#e0d8ce" }} />
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer text-[#c0545a] hover:bg-red-50 focus:bg-red-50 text-sm"
                    onClick={() => deleteConversation(convo.ID)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
