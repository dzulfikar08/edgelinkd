import { useConnectionStore } from "../../store/connection-store";

export function ConnectModeOverlay() {
  const mode = useConnectionStore((s) => s.mode);
  const cancelConnection = useConnectionStore((s) => s.cancelConnection);

  if (mode === "idle") return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-30 md:hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-amber-500 text-white text-sm font-medium shadow-lg">
        <span>
          {mode === "selecting-source"
            ? "Tap a source port"
            : "Tap a target port to connect"}
        </span>
        <button
          type="button"
          onClick={cancelConnection}
          className="px-3 py-1 rounded bg-white/20 text-xs font-semibold active:bg-white/30"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
