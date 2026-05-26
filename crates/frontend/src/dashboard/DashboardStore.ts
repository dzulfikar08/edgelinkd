import { create } from "zustand";
import { client } from "../api/client";
import { commsClient } from "../ws/comms";

// --- Types ---

export interface WidgetConfig {
  x: number;
  y: number;
  w: number;
  h: number;
  [key: string]: unknown;
}

export interface Widget {
  id: string;
  type: string;
  title: string;
  config: WidgetConfig;
  data?: Record<string, unknown>;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  created_at: string;
  updated_at: string;
}

interface DashboardState {
  dashboards: Dashboard[];
  activeDashboardId: string | null;
  loading: boolean;
  error: string | null;

  // Fetch
  fetchDashboards: () => Promise<void>;
  fetchDashboard: (id: string) => Promise<Dashboard>;

  // CRUD
  createDashboard: (name: string, description?: string) => Promise<Dashboard>;
  updateDashboard: (id: string, data: Partial<Pick<Dashboard, "name" | "description" | "widgets">>) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;

  // Active
  setActiveDashboard: (id: string | null) => void;

  // Widget helpers
  addWidget: (dashboardId: string, widget: Omit<Widget, "id">) => Promise<void>;
  updateWidget: (dashboardId: string, widgetId: string, patch: Partial<Widget>) => Promise<void>;
  removeWidget: (dashboardId: string, widgetId: string) => Promise<void>;

  // Local state (optimistic)
  setWidgets: (widgets: Widget[]) => void;

  // Real-time updates
  subscribeToLiveData: () => () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  dashboards: [],
  activeDashboardId: null,
  loading: false,
  error: null,

  fetchDashboards: async () => {
    set({ loading: true, error: null });
    try {
      const data = await client.get<Dashboard[]>("/dashboard");
      set({ dashboards: data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dashboards";
      set({ error: message, loading: false });
    }
  },

  fetchDashboard: async (id) => {
    const data = await client.get<Dashboard>(`/dashboard/${id}`);
    set((state) => ({
      dashboards: state.dashboards.map((d) => (d.id === id ? data : d)),
    }));
    return data;
  },

  createDashboard: async (name, description) => {
    const data = await client.post<Dashboard>("/dashboard", { name, description: description ?? "" });
    set((state) => ({ dashboards: [...state.dashboards, data] }));
    return data;
  },

  updateDashboard: async (id, patch) => {
    const current = get().dashboards.find((d) => d.id === id);
    if (!current) return;
    // Optimistic update
    const updated = { ...current, ...patch, updated_at: new Date().toISOString() };
    set((state) => ({
      dashboards: state.dashboards.map((d) => (d.id === id ? updated : d)),
    }));
    try {
      await client.put(`/dashboard/${id}`, patch);
    } catch {
      // Revert on error
      set((state) => ({
        dashboards: state.dashboards.map((d) => (d.id === id ? current : d)),
      }));
    }
  },

  deleteDashboard: async (id) => {
    const prev = get().dashboards;
    set((state) => ({
      dashboards: state.dashboards.filter((d) => d.id !== id),
      activeDashboardId: state.activeDashboardId === id ? null : state.activeDashboardId,
    }));
    try {
      await client.delete(`/dashboard/${id}`);
    } catch {
      set({ dashboards: prev });
    }
  },

  setActiveDashboard: (id) => set({ activeDashboardId: id }),

  addWidget: async (dashboardId, widget) => {
    const id = crypto.randomUUID();
    const newWidget: Widget = { ...widget, id };
    const current = get().dashboards.find((d) => d.id === dashboardId);
    if (!current) return;
    const widgets = [...current.widgets, newWidget];
    set((state) => ({
      dashboards: state.dashboards.map((d) =>
        d.id === dashboardId ? { ...d, widgets } : d,
      ),
    }));
    try {
      await client.put(`/dashboard/${dashboardId}`, { widgets });
    } catch {
      // revert handled via refetch if needed
    }
  },

  updateWidget: async (dashboardId, widgetId, patch) => {
    const current = get().dashboards.find((d) => d.id === dashboardId);
    if (!current) return;
    const widgets = current.widgets.map((w) =>
      w.id === widgetId ? { ...w, ...patch } : w,
    );
    const prev = current.widgets;
    set((state) => ({
      dashboards: state.dashboards.map((d) =>
        d.id === dashboardId ? { ...d, widgets } : d,
      ),
    }));
    try {
      await client.put(`/dashboard/${dashboardId}`, { widgets });
    } catch {
      set((state) => ({
        dashboards: state.dashboards.map((d) =>
          d.id === dashboardId ? { ...d, widgets: prev } : d,
        ),
      }));
    }
  },

  removeWidget: async (dashboardId, widgetId) => {
    const current = get().dashboards.find((d) => d.id === dashboardId);
    if (!current) return;
    const prev = current.widgets;
    const widgets = current.widgets.filter((w) => w.id !== widgetId);
    set((state) => ({
      dashboards: state.dashboards.map((d) =>
        d.id === dashboardId ? { ...d, widgets } : d,
      ),
    }));
    try {
      await client.put(`/dashboard/${dashboardId}`, { widgets });
    } catch {
      set((state) => ({
        dashboards: state.dashboards.map((d) =>
          d.id === dashboardId ? { ...d, widgets: prev } : d,
        ),
      }));
    }
  },

  setWidgets: (widgets) => {
    const id = get().activeDashboardId;
    if (!id) return;
    set((state) => ({
      dashboards: state.dashboards.map((d) =>
        d.id === id ? { ...d, widgets } : d,
      ),
    }));
  },

  /**
   * Subscribe to real-time dashboard data pushed by the `ui_dashboard_data`
   * flow node over the WebSocket `/comms` connection.
   *
   * Messages arrive on the `dashboard/data` topic and contain:
   *   { widget_id, dashboard_id?, payload, timestamp }
   *
   * When a matching widget is found on any loaded dashboard, its `data`
   * field is updated in-place, triggering a React re-render.
   *
   * Returns an unsubscribe function.
   */
  subscribeToLiveData: () => {
    // Subscribe to the dashboard/data topic on the server so the WebSocket
    // starts forwarding dashboard messages to this client.
    commsClient.subscribe("dashboard/data");

    const unsubscribe = commsClient.on("dashboard/data", (raw) => {
      const msg = raw as {
        widget_id: string;
        dashboard_id?: string;
        payload: Record<string, unknown>;
        timestamp: number;
      };
      if (!msg.widget_id) return;

      set((state) => ({
        dashboards: state.dashboards.map((d) => {
          // If dashboard_id is specified, only update the matching dashboard
          if (msg.dashboard_id && d.id !== msg.dashboard_id) return d;
          const hasWidget = d.widgets.some((w) => w.id === msg.widget_id);
          if (!hasWidget) return d;
          return {
            ...d,
            widgets: d.widgets.map((w) =>
              w.id === msg.widget_id ? { ...w, data: { ...w.data, ...msg.payload } } : w,
            ),
          };
        }),
      }));
    });

    return () => {
      unsubscribe();
      commsClient.unsubscribe("dashboard/data");
    };
  },
}));
