import type { AiSettings } from "@/context/AuthContext";

/**
 * Send prompt to FastAPI directly - No Express needed!
 * Handles both text and file uploads
 */
export const sendPrompt = async (
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

  try {
    // Call FastAPI /summarize endpoint directly
    const response = await fetch(`/api/summarize`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      response: data.final_summary,
      model: "combined",
      details: {
        bart: data.bart_summary,
        t5: data.t5_summary,
        lexrank: data.extractive_summary,
      },
    };
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};

// Ollama-specific function
export const summarizeWithOllama = async (
  text: string,
  file: File | null,
  model: string = "mistral"
) => {
  const formData = new FormData();
  formData.append("text", text);
  formData.append("model", model);

  if (file) {
    formData.append("file", file);
  }

  try {
    const response = await fetch(`/api/ollama/summarize`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Ollama error:", error);
    throw error;
  }
};

// Check Ollama status
export const checkOllamaStatus = async () => {
  try {
    const response = await fetch(`/api/ollama/status`, {
      credentials: "include",
    });
    return response.ok ? await response.json() : { online: false };
  } catch {
    return { online: false, status: "offline" };
  }
};

// Get available Ollama models
export const getOllamaModels = async () => {
  try {
    const response = await fetch(`/api/ollama/models`, {
      credentials: "include",
    });
    return response.ok ? await response.json() : { models: [], status: "error" };
  } catch {
    return { models: [], status: "error" };
  }
};
