

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
    return (
        <div className="border-l-2 border-gray-300 pl-4 space-y-4">
            {events.map((e, idx) => (
                <div key={idx} className="relative">
                    {/* Dot */}
                    <div className="absolute -left-2.5 top-1 w-3 h-3 rounded-full bg-blue-500 border border-white"></div>
                    {/* Content */}
                    <div>
                        <div className="text-sm font-semibold">
                            {e.eventType.replace(/_/g, " ")}
                        </div>
                        <div className="text-xs text-gray-500">
                            {new Date(e.timestamp).toLocaleString()}
                            {e.actor && ` • ${e.actor}`}
                        </div>
                        {typeof e.details === "object" && e.details !== null && (
                            <pre className="text-xs bg-gray-100 p-2 mt-1 rounded">
                                {JSON.stringify(e.details, null, 2)}
                            </pre>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
