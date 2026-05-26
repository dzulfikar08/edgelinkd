interface GaugeWidgetProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
}

export function GaugeWidget({
  value,
  min = 0,
  max = 100,
  label,
  unit = "",
}: GaugeWidgetProps) {
  const clamped = Math.min(Math.max(value, min), max);
  const pct = (clamped - min) / (max - min);
  const angle = pct * 270;

  const cx = 60;
  const cy = 60;
  const r = 46;
  const strokeWidth = 8;

  // Arc path helper
  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  };

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Color based on percentage
  const color = pct < 0.4 ? "#22c55e" : pct < 0.7 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-2">
      <svg viewBox="0 0 120 120" className="w-full max-w-[160px]">
        {/* Background arc */}
        <path
          d={describeArc(cx, cy, r, -225, 45)}
          fill="none"
          stroke="currentColor"
          className="text-gray-200 dark:text-gray-700"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {angle > 0 && (
          <path
            d={describeArc(cx, cy, r, -225, -225 + angle)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Value text */}
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-gray-900 dark:fill-gray-100"
          fontSize="18"
          fontWeight="bold"
          fontFamily="inherit"
        >
          {clamped.toFixed(1)}{unit}
        </text>
      </svg>
      {label && (
        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center truncate w-full">
          {label}
        </span>
      )}
    </div>
  );
}
