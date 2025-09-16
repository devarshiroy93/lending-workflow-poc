import { useState } from "react";
import { submitApplication } from "../api/client";

// Define the expected response shape from backend
interface SubmitResponse {
  applicationId: string;
}

export default function SubmitApplication() {
  const [amount, setAmount] = useState<number>(0);
  const [purpose, setPurpose] = useState("");
  const [status, setStatus] = useState<null | string>(null);

  const userId = import.meta.env.VITE_USER_ID;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Submitting...");

    try {
      const result: SubmitResponse = await submitApplication(userId, {
        amount,
        purpose,
      });
      setStatus(`Application submitted! ID: ${result.applicationId}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setStatus(` Error: ${err.message}`);
      } else {
        setStatus(" Unknown error occurred");
      }
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">Submit Loan Application</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Purpose</label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Submit
        </button>
      </form>

      {status && <p className="mt-4">{status}</p>}
    </div>
  );
}
