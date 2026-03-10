import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { TextareaForm } from "@/components/TextareaForm";
import { sendPrompt } from "@/services/chatService";
import { ChatHistory } from "@/components/chatHistory";
import { getConversationsMessages } from "@/services/conversationService";

export interface Message {
  role: "user" | "model";
  content: string;
}

export default function Dashboard() {
  const { user, activeConversationId, addConversation, selectConversation } =
    useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);

  useEffect(() => {
    if (activeConversationId) {
      setIsLoadingResponse(true);
      getConversationsMessages(activeConversationId)
        .then(setMessages)
        .finally(() => setIsLoadingResponse(false));
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  const handelPromptSubmit = async (prompt: string, file: File | null) => {
    const userMessage = file ? `${prompt}(File:${file.name})` : prompt;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoadingResponse(true);

    try {
      const result = await sendPrompt(prompt, file);
      setMessages((prev) => [
        ...prev,
        { role: "model", content: result.response },
      ]);

      if (!activeConversationId && result.conversationId) {
        if (user) {
          const newConvo = {
            ID: result.conversationId,
            title: prompt.substring(0, 50),
            userId: user.ID,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          addConversation(newConvo);
          selectConversation(newConvo.ID);
        }
      }
    } catch (error) {
      console.error("Failed to send Prompt:", error);
      setMessages((prev) => [
        ...prev,
        { role: "model", content: "Sorry,Something went wrong " },
      ]);
    } finally {
      setIsLoadingResponse(false);
    }
  };
  return (
    <div className=" h-screen flex  bg-[rgb(36,38,52)] ">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <main className="relative flex flex-1 flex-col flex-grow items-center p-8 bg-slate-100 overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-8">
              <ChatHistory
                messages={messages}
                isLoading={isLoadingResponse}
                user={user}
              />
            </div>
            <div className="w-full justify-items-center p-4 static ">
              <TextareaForm
                onSubmit={handelPromptSubmit}
                isLoading={isLoadingResponse}
              />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
