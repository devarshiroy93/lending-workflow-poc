import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import StatusChip from "../components/StatusChip";
import { format } from "date-fns";

interface Application {
  applicationId: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface GetApplicationsResponse {
  applications: Application[];
}

export default function ApplicationsList() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const userId = import.meta.env.VITE_USER_ID;

  useEffect(() => {
    const controller = new AbortController();

    const fetchApplications = async () => {
      setError(null);
      setLoading(true);

      try {
        const data: GetApplicationsResponse = await apiClient(
          "/applications",
          { method: "GET", signal: controller.signal },
          userId
        );

        setApplications(data.applications);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error) setError(err.message);
        else setError("Unknown error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
    return () => controller.abort();
  }, [userId]);

  if (loading) return <p className="p-4">Loading...</p>;
  if (error) return <p className="p-4 text-red-500">Error: {error}</p>;

  return (
    <div className="p-6 font-montserrat">
      <h1 className="text-xl font-bold mb-4">My Loan Applications</h1>

      {applications.length === 0 ? (
        <p className="text-gray-600">No applications found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-md">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3 border-b">Application ID</th>
                <th className="p-3 border-b">Amount</th>
                <th className="p-3 border-b">Status</th>
                <th className="p-3 border-b">Created At</th>
                <th className="p-3 border-b">Updated At</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.applicationId} className="hover:bg-gray-50">
                  <td className="p-3 border-b break-words max-w-xs">
                    {app.applicationId}
                  </td>
                  <td className="p-3 border-b">
                    ${app.amount.toLocaleString()}
                  </td>
                  <td className="p-3 border-b">
                    <StatusChip status={app.status} />
                  </td>
                  <td className="p-3 border-b">
                    {app.createdAt
                      ? format(new Date(app.createdAt), "do MMMM yyyy 'at' HH:mm")
                      : "-"}
                  </td>
                  <td className="p-3 border-b">
                    {app.updatedAt
                      ? format(new Date(app.updatedAt), "do MMMM yyyy 'at' HH:mm")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
