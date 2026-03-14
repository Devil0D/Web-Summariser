"use client";
import { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import api from "@/header/api";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "./ui/button";
import sendIcon from "../assets/send.png";
import microphoneIcon from "../assets/microphone.png";
import addFile from "../assets/plus.png";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HardDrive, Upload, File as FileIcon, X, Mic, MicOff } from "lucide-react";
import { useGooglePicker } from "@/hooks/useGooglePicker";

interface FormData {
  text: string;
}

// ── Voice input via Web Speech API ─────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function TextareaForm({
  onSubmit: onPromptSubmit,
  isLoading,
}: {
  onSubmit: (prompt: string, file: File | null) => void;
  isLoading: boolean;
}) {
  const form = useForm<FormData>({ defaultValues: { text: "" } });
  const { openPicker } = useGooglePicker();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(
    typeof window !== "undefined" &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const textWatch = form.watch("text");

  // ── voice recognition setup ───────────────────────────────────────────────
  useEffect(() => {
    if (!voiceSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      form.setValue("text", transcript);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Voice input error — please try again");
    };

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, [voiceSupported, form]);

  const toggleVoice = () => {
    if (!voiceSupported || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      form.setValue("text", "");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // ── Google Drive ──────────────────────────────────────────────────────────
  const handleDriverClick = () => {
    openPicker((file) => {
      toast(`Selected file: ${file.name}`);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      setSelectedFile(file);
      setIsPopoverOpen(false);
    }
  };

  // ── submit ────────────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    if (!data.text.trim() && !selectedFile) return;

    onPromptSubmit(data.text.trim(), selectedFile);
    form.reset();

    const formData = new FormData();
    formData.append("text", data.text);
    if (selectedFile) formData.append("file", selectedFile);

    try {
      await api.post("/chat", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      form.reset();
      setSelectedFile(null);
    } catch {
      // parent already shows the response; silent here
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-2xl mx-auto"
      >
        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div
                  className="relative rounded-2xl border transition-shadow duration-200"
                  style={{
                    background: "#fdfaf7",
                    borderColor: isListening ? "#5a9e7a" : "#e0d8ce",
                    boxShadow: isListening
                      ? "0 0 0 3px rgba(90,158,122,0.18)"
                      : "0 1px 4px rgba(100,80,60,0.08)",
                  }}
                >
                  {/* attached file badge */}
                  {selectedFile && (
                    <div
                      className="mx-3 mt-3 mb-1 flex w-fit items-center gap-2 rounded-xl px-3 py-2 text-sm"
                      style={{ background: "#f0ebe4", color: "#7c6d5e" }}
                    >
                      <FileIcon className="h-4 w-4 flex-shrink-0 text-[#c4956a]" />
                      <span className="font-medium truncate max-w-[200px]">
                        {selectedFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="ml-1 rounded-full p-0.5 hover:bg-[#e0d8ce] transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* voice indicator bar */}
                  {isListening && (
                    <div className="mx-3 mt-2 flex items-center gap-2">
                      <div className="voice-wave active">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      <span className="text-xs text-[#5a9e7a] font-semibold">
                        Listening…
                      </span>
                    </div>
                  )}

                  {/* textarea */}
                  <Textarea
                    placeholder={
                      isListening
                        ? "Speak now…"
                        : "Enter a URL, paste text, or ask Websears anything"
                    }
                    className="w-full resize-none border-0 bg-transparent px-4 pt-3 pb-12 text-[#3d3530] placeholder:text-[#c4b5a0] focus-visible:ring-0 focus-visible:ring-offset-0 text-sm leading-relaxed"
                    {...field}
                    disabled={isLoading}
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        form.handleSubmit(onSubmit)();
                        e.currentTarget.blur();
                      }
                    }}
                  />

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".txt,.pdf,.md"
                  />

                  {/* bottom-left: attach */}
                  <div className="absolute bottom-2.5 left-3 flex items-center gap-1">
                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                type="button"
                                className="h-8 w-8 rounded-xl hover:bg-[#f0ebe4] text-[#b0a090] hover:text-[#c4956a] transition-colors"
                              >
                                <img src={addFile} alt="Add file" className="size-5" />
                              </Button>
                            </PopoverTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">Attach file</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <PopoverContent
                        className="w-44 p-1 rounded-xl"
                        style={{
                          background: "#fdfaf7",
                          border: "1px solid #e0d8ce",
                          boxShadow: "0 4px 12px rgba(100,80,60,0.12)",
                        }}
                      >
                        <div className="grid gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start text-[#7c6d5e] hover:bg-[#f0ebe4] hover:text-[#c4956a] text-xs rounded-lg"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="mr-2 h-3.5 w-3.5" />
                            Upload file
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start text-[#7c6d5e] hover:bg-[#f0ebe4] hover:text-[#c4956a] text-xs rounded-lg"
                            onClick={handleDriverClick}
                          >
                            <HardDrive className="mr-2 h-3.5 w-3.5" />
                            From Drive
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* bottom-right: voice + send */}
                  <div className="absolute bottom-2.5 right-3 flex items-center gap-1.5">
                    {/* Voice button — always shown */}
                    {voiceSupported && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              type="button"
                              disabled={isLoading}
                              onClick={toggleVoice}
                              className={`h-8 w-8 rounded-xl transition-all ${
                                isListening
                                  ? "bg-[#d4f0e4] text-[#5a9e7a] hover:bg-[#c0e8d0]"
                                  : "hover:bg-[#f0ebe4] text-[#b0a090] hover:text-[#c4956a]"
                              }`}
                            >
                              {isListening ? (
                                <MicOff className="h-4 w-4" />
                              ) : (
                                <Mic className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">
                              {isListening ? "Stop listening" : "Voice input"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {/* Send button */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            type="submit"
                            disabled={isLoading || (!textWatch.trim() && !selectedFile)}
                            className="h-8 w-8 rounded-xl transition-all disabled:opacity-30"
                            style={{
                              background:
                                textWatch.trim() || selectedFile
                                  ? "linear-gradient(135deg,#c4956a,#b87850)"
                                  : undefined,
                              color:
                                textWatch.trim() || selectedFile ? "#fff" : undefined,
                              boxShadow:
                                textWatch.trim() || selectedFile
                                  ? "0 2px 6px rgba(196,149,106,0.3)"
                                  : undefined,
                            }}
                          >
                            <img src={sendIcon} alt="Send" className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">Send (Enter)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </FormControl>
              <FormDescription />
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
