interface IndicatorWidgetProps {
  status?: "green" | "yellow" | "red" | "off";
  label?: string;
}

const statusColors: Record<string, string> = {
  green: "#22c55e",
  yellow: "#f59e0b",
  red: "#ef4444",
  off: "#9ca3af",
};

export function IndicatorWidget({ status = "off", label }: IndicatorWidgetProps) {
  const fill = statusColors[status] ?? statusColors.off;

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-3">
      <svg viewBox="0 0 40 40" className="w-10 h-10">
        <circle cx="20" cy="20" r="16" fill={fill} opacity={status === "off" ? 0.3 : 0.2} />
        <circle cx="20" cy="20" r="10" fill={fill} />
        {status !== "off" && (
          <circle cx="20" cy="20" r="10" fill={fill} opacity={0.4}>
            <animate
              attributeName="r"
              from="10"
              to="16"
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              from="0.4"
              to="0"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>
      {label && (
        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center truncate w-full">
          {label}
        </span>
      )}
    </div>
  );
}
