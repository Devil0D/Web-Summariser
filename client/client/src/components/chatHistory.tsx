import { type Message } from "@/pages/Dashboard";
import { User, Bot, Loader2 } from "lucide-react";

interface User {
  Username: string;
  Email: string;
}
export const ChatHistory = ({
  messages,
  isLoading,
  user,
}: {
  messages: Message[];
  isLoading: boolean;
  user: User | null;
}) => {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <h1 className="text-3xl text-center">
          Hello {user ? user.Username : "Guest"}
        </h1>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-8">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex items-start gap-4 ${
            message.role === "user" ? "flex-row-reverse" : ""
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              message.role === "user"
                ? "bg-blue-500 text-white"
                : "bg-neutral-200"
            }`}
          >
            {message.role === "user" ? <User size={18} /> : <Bot size={18} />}
          </div>

          <div
            className={`flex-1 ${message.role === "user" ? "text-right" : ""}`}
          >
            <p className="font-semibold">
              {message.role === "user" ? user?.Username : "Websears"}
            </p>
            <p className="text-neutral-700">{message.content}</p>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200">
            <Bot size={30} />
          </div>
          <div className="flex-1 rounded-lg p-3 flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin " />
            <p className="text-neutral-700">Thinking...</p>
          </div>
        </div>
      )}
    </div>
  );
};
