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
    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const responseBody = isJson ? await response.json() : undefined;

    if (!response.ok) {
      const message = responseBody?.message || `API Error: ${response.statusText}`;
      throw new Error(message);
    }

    if (isJson) {
      return responseBody;
    }
    return;
  } catch (err: any) {
    console.error(`API call to ${endpoint} failed`, err);
    throw err;
  }
}

export default apiFetch;
