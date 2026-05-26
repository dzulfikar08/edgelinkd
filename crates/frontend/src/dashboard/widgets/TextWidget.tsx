interface TextWidgetProps {
  value?: string | number;
  label?: string;
  unit?: string;
}

export function TextWidget({ value = "--", label, unit = "" }: TextWidgetProps) {
  const display = typeof value === "number" ? value.toFixed(2) : String(value);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-3">
      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
        {display}
        {unit && <span className="text-sm font-normal ml-1 text-gray-500">{unit}</span>}
      </span>
      {label && (
        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center truncate w-full">
          {label}
        </span>
      )}
    </div>
  );
}
