import type {
  Plugin,
  WidgetPlugin,
  NodeTypePlugin,
} from "./types";

class PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private widgets = new Map<string, WidgetPlugin>();
  private nodeTypes = new Map<string, NodeTypePlugin>();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin "${plugin.id}" is already registered. Skipping.`);
      return;
    }

    this.plugins.set(plugin.id, plugin);

    if (plugin.widgets) {
      for (const widget of plugin.widgets) {
        this.widgets.set(widget.id, widget);
      }
    }

    if (plugin.nodeTypes) {
      for (const nodeType of plugin.nodeTypes) {
        this.nodeTypes.set(nodeType.type, nodeType);
      }
    }
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    if (plugin.widgets) {
      for (const widget of plugin.widgets) {
        this.widgets.delete(widget.id);
      }
    }

    if (plugin.nodeTypes) {
      for (const nodeType of plugin.nodeTypes) {
        this.nodeTypes.delete(nodeType.type);
      }
    }

    this.plugins.delete(pluginId);
  }

  getWidget(id: string): WidgetPlugin | undefined {
    return this.widgets.get(id);
  }

  getAllWidgets(): WidgetPlugin[] {
    return Array.from(this.widgets.values());
  }

  getNodeType(type: string): NodeTypePlugin | undefined {
    return this.nodeTypes.get(type);
  }

  getAllNodeTypes(): NodeTypePlugin[] {
    return Array.from(this.nodeTypes.values());
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}

export const pluginRegistry = new PluginRegistry();
