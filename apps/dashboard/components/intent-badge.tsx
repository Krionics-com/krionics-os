const INTENT_CLASSES: Record<string, string> = {
  POSITIVE: "bg-green-100 text-green-800",
  BOOKING_INTENT: "bg-blue-100 text-blue-800",
  OBJECTION: "bg-yellow-100 text-yellow-800",
  FAQ: "bg-purple-100 text-purple-800",
  NURTURE: "bg-teal-100 text-teal-800",
  UNSUBSCRIBE: "bg-red-100 text-red-800",
  NOT_RELEVANT: "bg-gray-100 text-gray-800",
  BOUNCE_OOO: "bg-orange-100 text-orange-800",
  HOSTILE: "bg-red-200 text-red-900",
  UNKNOWN: "bg-gray-100 text-gray-800"
};

type IntentBadgeProps = {
  intent?: string | null;
};

export function IntentBadge({ intent }: IntentBadgeProps) {
  const label = intent ?? "UNKNOWN";
  const className = INTENT_CLASSES[label] ?? INTENT_CLASSES.UNKNOWN;

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${className}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}
