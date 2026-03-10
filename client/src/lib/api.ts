/**
 * A reusable fetch utility for all API calls.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
 async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;

  const config: RequestInit = {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "content-type": "application/json" }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }
    return;
  } catch (err: any) {
    console.error(`API call to ${endpoint} failed`, err);
    throw err;
  }
}

export default apiFetch;
