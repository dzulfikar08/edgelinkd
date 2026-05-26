import { Trash2 } from "lucide-react";
import { useEditorStore } from "../../store/editor-store";

export function DebugPanel() {
  const debugMessages = useEditorStore((s) => s.debugMessages);
  const clearDebugMessages = useEditorStore((s) => s.clearDebugMessages);

  return (
    <div
      className="flex flex-col border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
      style={{ height: "var(--debug-panel-height)" }}
    >
      <div className="flex items-center justify-between px-3 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          Debug
          {debugMessages.length > 0 && (
            <span className="ml-1 text-gray-400">
              ({debugMessages.length})
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={clearDebugMessages}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Clear debug messages"
        >
          <Trash2 size={12} className="text-gray-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {debugMessages.length === 0 ? (
          <div className="p-3 text-gray-400 text-center">
            No debug messages
          </div>
        ) : (
          debugMessages.map((msg, i) => (
            <div
              key={`${msg.id}-${i}`}
              className="px-3 py-1 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-[10px]">
                  {msg.timestamp}
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  {msg.topic || msg.name}
                </span>
              </div>
              <div className="text-gray-700 dark:text-gray-300 break-all">
                {msg.msg}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
