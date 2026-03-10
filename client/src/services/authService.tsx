import apiFetch from "@/lib/api";

/**
 * Checks if a user is authenticated.
 */
export const checkAuthStatus = () => {
  return apiFetch("/auth/check-auth", { method: "GET" });
};

/**
 * Logs the current user out.
 */

export const logoutUser = () => {
  return apiFetch("/auth/logout", { method: "POST" });
};
