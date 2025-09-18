type TimelineEvent = {
  eventType: string;
  actor: string | null;
  timestamp: string;
  details?: unknown | null;
};

interface TimelineProps {
  events: TimelineEvent[];
}

export default function Timeline({ events }: TimelineProps) {
  const getDotColor = (eventType: string) => {
    if (eventType.toUpperCase().includes("FAILED")) return "bg-red-500";
    if (eventType.toUpperCase().includes("PASSED")) return "bg-green-500";
    return "bg-blue-500";
  };

  return (
    <div className="border-l-2 border-gray-300 pl-4 space-y-4">
      {events.map((e, idx) => (
        <div key={idx} className="relative">
          {/* Dot */}
          <div
            className={`absolute -left-2.5 top-1 w-3 h-3 rounded-full border border-white mr-1 ${getDotColor(
              e.eventType
            )}`}
          ></div>
          {/* Content */}
          <div className="ml-1">
            <div className="text-sm font-semibold">
              {e.eventType.replace(/_/g, " ")}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(e.timestamp).toLocaleString()}
              {e.actor && ` • ${e.actor}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
