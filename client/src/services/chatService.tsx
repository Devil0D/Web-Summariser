import apiFetch from "../lib/api";
import type { AiSettings } from "@/context/AuthContext";

export const sendPrompt = (
  prompt: string,
  file: File | null,
  aiSettings: AiSettings
) => {
  const formData = new FormData();
  formData.append("text", prompt);

  if (aiSettings.apiKey.trim()) {
    formData.append("apiKey", aiSettings.apiKey.trim());
  }

  formData.append("preferredModel", aiSettings.preferredModel);

  if (file) {
    formData.append("file", file);
  }

  return apiFetch("/chat", {
    method: "POST",
    body: formData,
  });
};
