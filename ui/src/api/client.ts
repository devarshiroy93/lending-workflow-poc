// Base API client that handles headers and env vars
export const apiClient = async (
  path: string,
  options: RequestInit = {},
  userId: string
) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  const apiKey = import.meta.env.VITE_API_KEY;

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-user-id": userId,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "API request failed");
  }
  return res.json();
};

// Submit new loan application
export async function submitApplication(
  userId: string,
  payload: { amount: number; purpose: string }
) {
  return apiClient("/applications", {
    method: "POST",
    body: JSON.stringify(payload),
  }, userId);
}

// Fetch all applications for a user
export async function getApplications(userId: string) {
  return apiClient("/applications", { method: "GET" }, userId);
}
