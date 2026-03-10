import apiFetch from "@/lib/api";

export const getFolders = () => {
  return apiFetch("/folders", { method: "GET" });
};

export const createFolders = (name?: string) => {
  return apiFetch("/folders", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
};

export const deleteFolders = (id: number) => {
  return apiFetch(`/folders/${id}`, { method: "DELETE" });
};
