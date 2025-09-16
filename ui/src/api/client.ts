export async function submitApplication(
  userId: string,
  apiKey: string,
  payload: { amount: number; purpose: string }
) {
  const response = await fetch("https://cdvqg7u2rb.execute-api.us-east-1.amazonaws.com/dev/applications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || "Failed to submit application");
  }

  return response.json();
}
