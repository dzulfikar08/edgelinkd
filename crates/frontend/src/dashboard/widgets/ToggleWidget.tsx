import { useState, useCallback } from "react";

interface ToggleWidgetProps {
  on?: boolean;
  label?: string;
  mqttTopic?: string;
  onToggle?: (value: boolean) => void;
}

export function ToggleWidget({ on = false, label, mqttTopic, onToggle }: ToggleWidgetProps) {
  const [state, setState] = useState(on);

  const handleToggle = useCallback(() => {
    const next = !state;
    setState(next);
    onToggle?.(next);
    // MQTT binding: in a real implementation, publish to mqttTopic here
    if (mqttTopic) {
      console.log(`ToggleWidget: publish ${next} to ${mqttTopic}`);
    }
  }, [state, onToggle, mqttTopic]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-3">
      {label && (
        <span className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center truncate w-full">
          {label}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={state}
        onClick={handleToggle}
        className={`
          relative w-12 h-6 rounded-full transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          ${state
            ? "bg-green-500"
            : "bg-gray-300 dark:bg-gray-600"
          }
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
            transition-transform duration-200
            ${state ? "translate-x-6" : "translate-x-0"}
          `}
        />
      </button>
      <span className="text-[10px] text-gray-400 mt-1">
        {state ? "ON" : "OFF"}
      </span>
    </div>
  );
}
