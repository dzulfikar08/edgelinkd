import { useEffect, useCallback, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LayoutDashboard, Share2 } from "lucide-react";
import { AppShell } from "./components/layout/AppShell";
import { flowsApi } from "./api/flows";
import { useFlowStore } from "./store/flow-store";
import { useEditorStore } from "./store/editor-store";
import { DashboardPage } from "./dashboard/DashboardPage";
import { useBreakpoint } from "./hooks";

type View = "flows" | "dashboard";

function AppInner() {
  const { setNodes, setEdges, setRevision } = useFlowStore();
  const { addNotification } = useEditorStore();
  const [view, setView] = useState<View>("flows");
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    flowsApi
      .getFlows()
      .then((data) => {
        setNodes(data.nodes);
        setEdges(data.edges);
        setRevision(data.rev);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to load flows";
        addNotification({ type: "error", message });
      });
  }, [setNodes, setEdges, setRevision, addNotification]);

  const handleDeploy = useCallback(async () => {
    const { nodes, edges, revision } = useFlowStore.getState();
    try {
      await flowsApi.postFlows({ nodes, edges, rev: revision });
      addNotification({ type: "success", message: "Flows deployed" });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Deploy failed";
      addNotification({ type: "error", message });
    }
  }, [addNotification]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Desktop view tabs */}
      {!isMobile && (
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" style={{ height: "var(--header-height)" }}>
          <div className="flex items-center gap-0 px-1">
            <button
              type="button"
              onClick={() => setView("flows")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "flows"
                  ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <Share2 size={14} />
              Flows
            </button>
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "dashboard"
                  ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <LayoutDashboard size={14} />
              Dashboard
            </button>
          </div>
          {view === "flows" && (
            <div className="ml-auto pr-2">
              <button
                type="button"
                onClick={handleDeploy}
                className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-white rounded transition-colors"
                style={{ backgroundColor: "var(--color-primary)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-primary-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-primary)";
                }}
              >
                Deploy
              </button>
            </div>
          )}
        </div>
      )}
      {/* View content */}
      <div className="flex-1 overflow-hidden">
        {isMobile ? (
          <AppShell onDeploy={handleDeploy} />
        ) : (
          view === "flows" ? <AppShell onDeploy={handleDeploy} /> : <DashboardPage />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  );
}
