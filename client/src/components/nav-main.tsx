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
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const { createFolder, deleteFolder } = useAuth();
  const [newFolderName, setNewFolderName] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handelCreateClick = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName("");
      setIsDialogOpen(false);
    }
  };

  return (
    <Collapsible defaultOpen>
      <SidebarGroup className="flex-col">
        {/*----HEADER SECTION-----*/}

        <SidebarGroupLabel>
          <CollapsibleTrigger className="group flex flex-1 items-center gap-2 cursor-pointer">
            <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
            <span>Folders</span>
          </CollapsibleTrigger>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <SidebarGroupAction asChild>
                <button aria-label="Create new Folder">
                  <Plus className="size-4" />
                </button>
              </SidebarGroupAction>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md bg-slate-400">
              <DialogHeader>
                <DialogTitle>Create Folder</DialogTitle>
              </DialogHeader>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Enter Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handelCreateClick()}
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  className="border hover:bg-slate-500"
                  onClick={handelCreateClick}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SidebarGroupLabel>

        {/* --- FOLDER LIST SECTION --- */}

        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <SidebarMenuItem key={item.id} className="group/menu-item">
                <div className="flex w-full items-center">
                  <Collapsible defaultOpen={item.isActive} className="flex-1">
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        asChild={!item.items?.length}
                        tooltip={item.title}
                        isActive={item.isActive}
                      >
                        {item.items?.length ? (
                          <span className="flex w-full items-center gap-2">
                            <item.icon />
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto size-4 transition-transform data-[state=open]:rotate-90" />
                          </span>
                        ) : (
                          <a
                            href={item.url}
                            className="flex w-full items-center gap-2"
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </a>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    {item.items?.length ? (
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild>
                                <a href={subItem.url}>
                                  <span>{subItem.title}</span>
                                </a>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    ) : null}
                  </Collapsible>
                  <button
                    onClick={() => deleteFolder(item.id)}
                    aria-label="Delete folder"
                    className="p-1 h-7 w-7 ml-1 opacity-0
              group-hover/menu-item:opacity-100 flex items-center justify-center rounded-md hover:bg-red-500/10 hover:text-red-500 "
                  >
                    <Trash2 className="size-4" />
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
