import apiFetch from "../lib/api";

export const sendPrompt = (prompt: string, file: File | null) => {
  const formData = new FormData();
  formData.append("text", prompt);
  if (file) {
    formData.append("file", file);
  }

  return apiFetch("/chat", {
    method: "POST",
    body: formData,
  });
};
