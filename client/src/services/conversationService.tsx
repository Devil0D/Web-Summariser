import apiFetch from "@/lib/api";

export const getConversations = () => {
  return apiFetch("/conversations", { method: "GET" });
};

export const deleteConversation = (id: number) => {
  return apiFetch(`/conversations/${id}`, { method: "DELETE" });
};

export const getConversationsMessages = (id: number) => {
  return apiFetch(`/conversations/${id}`, { method: "GET" });
};
