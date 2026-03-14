"use client";
import { useRef, useState } from "react";
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
import { HardDrive, Upload, File as FileIcon, X } from "lucide-react";
import { useGooglePicker } from "@/hooks/useGooglePicker";
interface FormData {
  text: string;
}

export function TextareaForm({
  onSubmit: onPromptSubmit,
  isLoading,
}: {
  onSubmit: (prompt: string, file: File | null) => void;
  isLoading: boolean;
}) {

  const form = useForm<FormData>({
    defaultValues: {
      text: "",
    },
  });

  const { openPicker } = useGooglePicker();
  const [isPopoverOpen, setIspopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handelDriverClick = () => {
    openPicker((file) => {
      toast(`Selected file:${file.name}`);
    });
  };

  const handelFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      setSelectedFile(file);
      setIspopoverOpen(false);
    }
  };

  const textWatch = form.watch("text");

  async function onSubmit(data: FormData) {
    const formData = new FormData();
    formData.append("text", data.text);

    if (data.text.trim()||selectedFile) {
      onPromptSubmit(data.text.trim(),selectedFile);
    }
    form.reset();

    if (selectedFile) {
      formData.append("file", selectedFile);
    }
    try {
      await api.post("/chat", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Prompt submitted sucessfully!");
      form.reset();
      setSelectedFile(null);
    } catch (error: any) {
      toast.error("Submission failed");
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-2/3 space-y-2 flex flex-col "
      >
        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative rounded-lg border bg-background focus-within:ring-ring">
                  {selectedFile && (
                    <div className="bg-slate-200 text-slate-900 rounded-lg p-3 flex w-60 h-20 items-center text-sm animate-in fade-in-50 ">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="font-medium truncate">
                          {selectedFile.name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <Textarea
                    placeholder="Enter a Prompt for Websears"
                    className="w-full resize-none border-0 bg-transparent p-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                    {...field}
                    disabled={isLoading}
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
                    onChange={handelFileSelect}
                    className="hidden"
                  />
                  <div className="absolute bottom-2 left-2 flex items-center gap-2">
                    <Popover
                      open={isPopoverOpen}
                      onOpenChange={setIspopoverOpen}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                type="button"
                                className=" rounded-full hover:bg-slate-400"
                              >
                                <img
                                  src={addFile}
                                  alt="Add file"
                                  className="size-8"
                                />
                              </Button>
                            </PopoverTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="bg-white p-2 rounded-md">Add file</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <PopoverContent className="w-auto p-1 bg-slate-300">
                        <div className="grid gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start hover:bg-slate-400"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Files
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start hover:bg-slate-400"
                            onClick={handelDriverClick}
                          >
                            <HardDrive className="mr-2 h-4 w-4" />
                            Add from Drive
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="absolute bottom-2 right-2 flex items-center gap-2">
                    <TooltipProvider>
                      {textWatch.trim().length > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              type="submit"
                              disabled={isLoading}
                              className="bg-slate-300 rounded-full hover:bg-slate-400"
                            >
                              <img
                                src={sendIcon}
                                alt="Send"
                                className="size-5"
                              />
                                                 
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="bg-white p-2 rounded-md">Submit</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              type="button"
                              disabled={isLoading}
                              className="bg-slate-300 rounded-full hover:bg-slate-400"
                            >
                              <img
                                src={microphoneIcon}
                                alt="Send"
                                className="size-5"
                              />
                                                         
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="bg-white p-2 rounded-md">
                              Use Microphone
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TooltipProvider>
                  </div>
                </div>
              </FormControl>
              <FormDescription></FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
