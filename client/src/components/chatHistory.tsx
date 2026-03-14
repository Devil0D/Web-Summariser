import { type Message } from "@/pages/Dashboard";
import { User, Bot, Loader2 } from "lucide-react";

interface UserType {
  Username: string;
  Email: string;
}

// ── noise cleaner (mirrors sidebar.js) ───────────────────────────────────────
function cleanNoise(text: string): string {
  return text
    .replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/[-_\s\.]{4,}/g, " … ")
    .replace(/(\b\w{4,}\b)\1{2,}/gi, "$1")
    .replace(/[[\](){}\*#&$@%!~`|\\^]{3,}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{3,}/g, " ")
    .trim();
}

// ── formatted summary renderer ────────────────────────────────────────────────
function FormattedSummary({ text }: { text: string }) {
  const cleaned = cleanNoise(text);
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentences.length <= 1) {
    return <p className="text-sm text-[#3d3530] leading-relaxed">{cleaned}</p>;
  }

  return (
    <div>
      <p className="summary-intro">{sentences[0]}</p>
      <ul className="summary-points">
        {sentences.slice(1).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

export const ChatHistory = ({
  messages,
  isLoading,
  user,
}: {
  messages: Message[];
  isLoading: boolean;
  user: UserType | null;
}) => {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
          style={{ background: "linear-gradient(135deg,#c4956a,#b87850)" }}
        >
          <span className="text-white text-xl font-bold" style={{ fontFamily: "'Playfair Display',serif" }}>
            W
          </span>
        </div>
        <h1
          className="text-2xl text-[#3d3530]"
          style={{ fontFamily: "'Playfair Display',serif" }}
        >
          Hello, {user ? user.Username : "there"}
        </h1>
        <p className="text-[#b0a090] text-sm">
          Summarize any page or paste text to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex items-start gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
        >
          {/* avatar */}
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${
              message.role === "user"
                ? "text-white"
                : "bg-[#f0ebe4] text-[#7c6d5e]"
            }`}
            style={
              message.role === "user"
                ? { background: "linear-gradient(135deg,#c4956a,#b87850)" }
                : {}
            }
          >
            {message.role === "user" ? <User size={15} /> : <Bot size={15} />}
          </div>

          {/* bubble */}
          <div className={`flex-1 max-w-[85%] ${message.role === "user" ? "items-end flex flex-col" : ""}`}>
            <p
              className="text-xs font-semibold mb-1"
              style={{ color: message.role === "user" ? "#c4956a" : "#7c6d5e" }}
            >
              {message.role === "user" ? (user?.Username ?? "You") : "Websears"}
            </p>

            <div
              className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                message.role === "user"
                  ? "text-white rounded-tr-sm"
                  : "bg-[#fdfaf7] border border-[#e0d8ce] rounded-tl-sm text-[#3d3530]"
              }`}
              style={
                message.role === "user"
                  ? { background: "linear-gradient(135deg,#c4956a,#b87850)" }
                  : {}
              }
            >
              {message.role === "assistant" ? (
                <FormattedSummary text={message.content} />
              ) : (
                <p className="leading-relaxed">{message.content}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0ebe4] text-[#7c6d5e]">
            <Bot size={15} />
          </div>
          <div className="bg-[#fdfaf7] border border-[#e0d8ce] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c4956a]" />
            <span className="text-[#b0a090] text-sm">Summarising…</span>
          </div>
        </div>
      )}
    </div>
  );
};
