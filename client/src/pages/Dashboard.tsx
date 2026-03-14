import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
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
  const {
    user,
    activeConversationId,
    addConversation,
    selectConversation,
    aiSettings,
  } = useAuth();
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
    const userMessage = file
      ? `${prompt ? `${prompt}\n` : ""}Attached file: ${file.name}`
      : prompt;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoadingResponse(true);

    try {
      const result = await sendPrompt(prompt, file, aiSettings);
      setMessages((prev) => [
        ...prev,
        { role: "model", content: result.response },
      ]);

      if (!activeConversationId && result.conversationId) {
        if (user) {
          const newConvo = {
            ID: result.conversationId,
            id: result.conversationId,
            title: prompt.substring(0, 50),
            userId: user.ID,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          addConversation(newConvo);
          selectConversation(newConvo.ID);
        }
      }
    } catch (error: any) {
      console.error("Failed to send Prompt:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content:
            error?.message ||
            "Sorry, something went wrong while processing this request.",
        },
      ]);
    } finally {
      setIsLoadingResponse(false);
    }
  };
  return (
    <div className="flex h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(242,247,243,0.9)_42%,_rgba(233,240,246,0.9)_100%)]">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <main className="relative flex flex-1 flex-col overflow-hidden px-4 py-5 md:px-8 md:py-7">
            <div className="mb-4 rounded-[28px] border border-white/70 bg-white/75 px-5 py-4 shadow-[0_18px_60px_-32px_rgba(73,96,84,0.45)] backdrop-blur md:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700/70">
                    Websears workspace
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold text-slate-800">
                    Summaries that read like notes, not raw dumps
                  </h1>
                </div>
                <div className="flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <Sparkles className="h-4 w-4" />
                  <span>
                    Model: {aiSettings.preferredModel}
                    {aiSettings.apiKey.trim() ? " · personal key active" : " · server key fallback"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide rounded-[30px] border border-white/80 bg-white/65 p-3 shadow-[0_20px_70px_-40px_rgba(64,79,93,0.6)] backdrop-blur md:p-6">
              <ChatHistory
                messages={messages}
                isLoading={isLoadingResponse}
                user={user}
              />
            </div>

            <div className="mt-4 w-full justify-items-center">
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
