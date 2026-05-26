import { useEffect, useState, useCallback } from "react";
import { LayoutDashboard, Plus, Trash2, Edit3, Check, ArrowLeft } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { DashboardGrid } from "./DashboardGrid";
import { useDashboardStore, type Widget } from "./DashboardStore";

export function DashboardPage() {
  const {
    dashboards,
    activeDashboardId,
    fetchDashboards,
    createDashboard,
    deleteDashboard,
    setActiveDashboard,
    addWidget,
    subscribeToLiveData,
  } = useDashboardStore();

  const [editMode, setEditMode] = useState(false);
  const [addingWidget, setAddingWidget] = useState(false);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  // Subscribe to real-time dashboard data from flow nodes
  useEffect(() => {
    const unsubscribe = subscribeToLiveData();
    return unsubscribe;
  }, [subscribeToLiveData]);

  const active = dashboards.find((d) => d.id === activeDashboardId);

  const handleCreate = useCallback(async () => {
    const d = await createDashboard(`Dashboard ${dashboards.length + 1}`);
    setActiveDashboard(d.id);
  }, [dashboards.length, createDashboard, setActiveDashboard]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDashboard(id);
    },
    [deleteDashboard],
  );

  const handleAddWidget = useCallback(
    async (type: string) => {
      if (!activeDashboardId) return;
      const defaultSizes: Record<string, { w: number; h: number }> = {
        gauge: { w: 3, h: 3 },
        chart: { w: 4, h: 3 },
        text: { w: 2, h: 2 },
        toggle: { w: 2, h: 2 },
        indicator: { w: 2, h: 2 },
      };
      const size = defaultSizes[type] ?? { w: 2, h: 2 };
      // Find a free position
      const occupied = new Set(
        active?.widgets.map((w) => `${w.config.x},${w.config.y}`) ?? [],
      );
      let x = 0;
      let y = 0;
      while (occupied.has(`${x},${y}`)) {
        x += 1;
        if (x >= 12) {
          x = 0;
          y += 1;
        }
      }

      const widget: Omit<Widget, "id"> = {
        type,
        title: type.charAt(0).toUpperCase() + type.slice(1),
        config: { x, y, w: size.w, h: size.h },
        data: getDefaultData(type),
      };
      await addWidget(activeDashboardId, widget);
      setAddingWidget(false);
    },
    [activeDashboardId, active?.widgets, addWidget],
  );

  // List view
  if (!active) {
    return (
      <DashboardLayout
        header={
          <>
            <LayoutDashboard size={16} />
            <span className="font-semibold text-sm">Dashboards</span>
            <button
              type="button"
              onClick={handleCreate}
              className="ml-auto flex items-center gap-1 px-2 py-1 text-xs font-medium text-white rounded transition-colors"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <Plus size={12} />
              New
            </button>
          </>
        }
      >
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-auto h-full">
          {dashboards.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActiveDashboard(d.id)}
              className="flex flex-col items-start p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:ring-2 hover:ring-blue-500 transition-all text-left"
            >
              <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate w-full">
                {d.name}
              </span>
              <span className="text-xs text-gray-500 mt-1">
                {d.widgets.length} widget{d.widgets.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-gray-400">
                  {new Date(d.updated_at).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(d.id);
                  }}
                  className="ml-auto p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </button>
          ))}
          {dashboards.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
              <LayoutDashboard size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No dashboards yet</p>
              <p className="text-xs mt-1">Click "New" to create one</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // Dashboard view
  return (
    <DashboardLayout
      header={
        <>
          <button
            type="button"
            onClick={() => setActiveDashboard(null)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="font-semibold text-sm">{active.name}</span>
          <span className="text-xs text-gray-400">
            {active.widgets.length} widget{active.widgets.length !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddingWidget(!addingWidget)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Plus size={12} />
              Widget
            </button>
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors ${
                editMode
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600"
                  : "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {editMode ? <Check size={12} /> : <Edit3 size={12} />}
              {editMode ? "Done" : "Edit"}
            </button>
          </div>
        </>
      }
    >
      {/* Widget type picker */}
      {addingWidget && (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-gray-400 flex-shrink-0">Add:</span>
          {["gauge", "chart", "text", "toggle", "indicator"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleAddWidget(t)}
              className="px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors capitalize"
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <DashboardGrid
        dashboardId={active.id}
        widgets={active.widgets}
        editable={editMode}
      />
    </DashboardLayout>
  );
}

function getDefaultData(type: string): Record<string, unknown> {
  switch (type) {
    case "gauge":
      return { value: 42, min: 0, max: 100, label: "Sensor", unit: "%" };
    case "chart":
      return {
        data: Array.from({ length: 20 }, (_, i) => ({
          t: i,
          v: Math.sin(i * 0.3) * 30 + 50 + Math.random() * 10,
        })),
        label: "Time Series",
        color: "#3b82f6",
      };
    case "text":
      return { value: 123.45, label: "Metric", unit: "units" };
    case "toggle":
      return { on: false, label: "Switch", mqttTopic: "" };
    case "indicator":
      return { status: "green", label: "Status" };
    default:
      return {};
  }
}
