import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { TextareaForm } from "@/components/TextareaForm";
import { sendPrompt } from "@/services/chatService";
import { ChatHistory } from "@/components/chatHistory";
import { getConversationsMessages } from "@/services/conversationService";
import { SettingsPanel } from "@/components/SettingsPanel";

export interface Message {
  role: "user" | "model";
  content: string;
}

export default function Dashboard() {
  const {
    user,
    activeConversationId,
    addConversation,
    selectConversation,
    aiSettings,
  } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  const handlePromptSubmit = async (prompt: string, file: File | null) => {
    const userMessage = file
      ? `${prompt ? `${prompt}\n` : ""}[File: ${file.name}]`
      : prompt;
    
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoadingResponse(true);

    try {
      const result = await sendPrompt(prompt, file, aiSettings);
      setMessages((prev) => [
        ...prev,
        { role: "model", content: result.response },
      ]);

      if (!activeConversationId && result.response) {
        if (user) {
          const newConvo = {
            ID: Date.now(),
            id: Date.now(),
            title: prompt.substring(0, 50) || file?.name || "Conversation",
            userId: user.ID,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          addConversation(newConvo);
          selectConversation(newConvo.ID);
        }
      }
    } catch (error: any) {
      console.error("Failed to send prompt:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: `Error: ${error?.message || "Failed to process request"}`,
        },
      ]);
    } finally {
      setIsLoadingResponse(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-white dark:bg-slate-950">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <main className="relative flex flex-1 flex-col overflow-hidden">
            {/* Header - Clean & Minimal */}
            <div className="flex items-center justify-between border-b bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Websears Chat
                </h1>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-slate-800"
                title="Settings"
              >
                <Settings className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto bg-white px-6 py-6 dark:bg-slate-950">
              <ChatHistory
                messages={messages}
                isLoading={isLoadingResponse}
                user={user}
              />
            </div>

            {/* Input Area */}
            <div className="border-t bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <TextareaForm
                onSubmit={handlePromptSubmit}
                isLoading={isLoadingResponse}
              />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
