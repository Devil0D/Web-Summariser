"use client";
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../services/authService";

export function NavUser({
  user,
}: {
  user: { name: string; email: string; avatar: string };
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();

  const initials = user.name ? user.name.slice(0, 2).toUpperCase() : "??";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="rounded-xl data-[state=open]:bg-[#f0ebe4] hover:bg-[#f0ebe4] transition-colors"
            >
              <Avatar className="h-8 w-8 rounded-xl">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback
                  className="rounded-xl text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#c4956a,#b87850)" }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-[#3d3530]">
                  {user.name}
                </span>
                <span className="truncate text-xs text-[#b0a090]">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-[#b0a090]" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-lg"
            style={{
              background: "#fdfaf7",
              border: "1px solid #e0d8ce",
              boxShadow: "0 8px 24px rgba(100,80,60,0.14)",
            }}
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-xl">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback
                    className="rounded-xl text-xs font-bold text-white"
                    style={{ background: "linear-gradient(135deg,#c4956a,#b87850)" }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-[#3d3530]">
                    {user.name}
                  </span>
                  <span className="truncate text-xs text-[#b0a090]">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator style={{ background: "#e0d8ce" }} />

            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer rounded-lg text-[#7c6d5e] hover:bg-[#f0ebe4] hover:text-[#c4956a] focus:bg-[#f0ebe4]">
                <Sparkles className="mr-2 h-4 w-4 text-[#c4956a]" />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator style={{ background: "#e0d8ce" }} />

            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer rounded-lg text-[#7c6d5e] hover:bg-[#f0ebe4] focus:bg-[#f0ebe4]">
                <BadgeCheck className="mr-2 h-4 w-4" />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer rounded-lg text-[#7c6d5e] hover:bg-[#f0ebe4] focus:bg-[#f0ebe4]">
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer rounded-lg text-[#7c6d5e] hover:bg-[#f0ebe4] focus:bg-[#f0ebe4]">
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator style={{ background: "#e0d8ce" }} />

            <DropdownMenuItem
              className="cursor-pointer rounded-lg text-[#c0545a] hover:bg-red-50 focus:bg-red-50"
              onClick={async () => {
                await logoutUser();
                sessionStorage.removeItem("visitedDashboard");
                navigate("/login", { replace: true });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
