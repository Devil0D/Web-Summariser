"use client";
import { useState } from "react";
import { Trash2, Plus, ChevronRight, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    id: number;
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    items?: { title: string; url: string }[];
  }[];
}) {
  const { createFolder, deleteFolder } = useAuth();
  const [newFolderName, setNewFolderName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreate = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName("");
      setIsDialogOpen(false);
    }
  };

  return (
    <Collapsible defaultOpen>
      <SidebarGroup className="flex-col">
        <SidebarGroupLabel>
          <CollapsibleTrigger className="group flex flex-1 items-center gap-2 cursor-pointer text-[#b0a090] hover:text-[#7c6d5e] transition-colors">
            <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
            <span className="text-xs font-semibold uppercase tracking-wider">Folders</span>
          </CollapsibleTrigger>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <SidebarGroupAction asChild>
                <button
                  aria-label="New folder"
                  className="text-[#b0a090] hover:text-[#c4956a] transition-colors"
                >
                  <Plus className="size-3.5" />
                </button>
              </SidebarGroupAction>
            </DialogTrigger>

            <DialogContent
              className="sm:max-w-sm rounded-2xl"
              style={{
                background: "#fdfaf7",
                border: "1px solid #e0d8ce",
                boxShadow: "0 12px 40px rgba(100,80,60,0.16)",
              }}
            >
              <DialogHeader>
                <DialogTitle
                  className="text-[#3d3530]"
                  style={{ fontFamily: "'Playfair Display',serif" }}
                >
                  New Folder
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Folder name…"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="border-[#e0d8ce] bg-[#f5f0eb] focus:border-[#c4956a] text-[#3d3530]"
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleCreate}
                  className="rounded-xl text-white font-semibold"
                  style={{ background: "linear-gradient(135deg,#c4956a,#b87850)" }}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <SidebarMenuItem key={item.id} className="group/menu-item">
                <div className="flex w-full items-center">
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={item.isActive}
                    className="flex-1 rounded-xl text-[#7c6d5e] hover:bg-[#f0ebe4] hover:text-[#3d3530] data-[active=true]:bg-[#f0ebe4] data-[active=true]:text-[#c4956a] transition-colors"
                  >
                    <item.icon className="size-3.5" />
                    <span className="truncate text-sm">{item.title}</span>
                  </SidebarMenuButton>

                  <button
                    onClick={() => deleteFolder(item.id)}
                    aria-label="Delete folder"
                    className="p-1 h-6 w-6 ml-1 opacity-0 group-hover/menu-item:opacity-100
                      flex items-center justify-center rounded-lg
                      hover:bg-red-50 hover:text-red-500 text-[#b0a090] transition-all"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </SidebarMenuItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
