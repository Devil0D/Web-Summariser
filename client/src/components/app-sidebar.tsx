import * as React from "react";
import {
  LifeBuoy,
  Send,
  Folder,
  PlusCircle,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { NavHistory } from "@/components/navHistory";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "../context/AuthContext";

const navSecondary = [
  { title: "Support", url: "#", icon: LifeBuoy },
  { title: "Feedback", url: "#", icon: Send },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, folders, selectConversation } = useAuth();

  const navItems = folders.map((folder) => ({
    id: folder.ID,
    title: folder.Folder_Name,
    url: "#",
    icon: Folder,
    items: [],
  }));

  return (
    <Sidebar variant="inset" {...props}>
      {/* ── header ── */}
      <SidebarHeader
        style={{ background: "#fdfaf7", borderBottom: "1px solid #ede7de" }}
      >
        <SidebarMenu>
          {/* branding */}
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#" className="hover:bg-transparent">
                <div
                  className="flex aspect-square size-8 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{ background: "linear-gradient(135deg,#c4956a,#b87850)" }}
                >
                  <span
                    className="text-sm font-bold"
                    style={{ fontFamily: "'Playfair Display',serif" }}
                  >
                    W
                  </span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span
                    className="truncate font-semibold text-[#3d3530]"
                    style={{ fontFamily: "'Playfair Display',serif" }}
                  >
                    Websears
                  </span>
                  <span className="truncate text-xs text-[#b0a090]">
                    AI Summariser
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* new chat */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => selectConversation(null)}
              className="rounded-xl text-[#7c6d5e] hover:bg-[#f0ebe4] hover:text-[#c4956a] transition-colors font-semibold"
            >
              <PlusCircle className="size-4 text-[#c4956a]" />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── content ── */}
      <SidebarContent
        className="scrollbar-hide"
        style={{ background: "#fdfaf7" }}
      >
        <NavMain items={navItems} />
        <NavHistory />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      {/* ── footer ── */}
      <SidebarFooter
        style={{ background: "#fdfaf7", borderTop: "1px solid #ede7de" }}
      >
        {user && (
          <NavUser
            user={{
              name: user.Username,
              email: user.Email,
              avatar: "/avatars/default.png",
            }}
          />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
