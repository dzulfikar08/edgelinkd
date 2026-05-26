import { pluginRegistry } from "../plugins/plugin-registry";
import { GaugeWidget } from "./widgets/GaugeWidget";
import { ChartWidget } from "./widgets/ChartWidget";
import { TextWidget } from "./widgets/TextWidget";
import { ToggleWidget } from "./widgets/ToggleWidget";
import { IndicatorWidget } from "./widgets/IndicatorWidget";
import type { Widget } from "./DashboardStore";

// Built-in widget type map
const builtInWidgets: Record<string, React.ComponentType<Record<string, unknown>>> = {
  gauge: GaugeWidget as React.ComponentType<Record<string, unknown>>,
  chart: ChartWidget as React.ComponentType<Record<string, unknown>>,
  text: TextWidget as React.ComponentType<Record<string, unknown>>,
  toggle: ToggleWidget as React.ComponentType<Record<string, unknown>>,
  indicator: IndicatorWidget as React.ComponentType<Record<string, unknown>>,
};

interface WidgetRendererProps {
  widget: Widget;
}

export function WidgetRenderer({ widget }: WidgetRendererProps) {
  // Try plugin registry first
  const pluginWidget = pluginRegistry.getWidget(widget.type);
  if (pluginWidget) {
    const Comp = pluginWidget.component;
    return <Comp {...(widget.data ?? {})} {...widget.config} />;
  }

  // Fall back to built-in widgets
  const BuiltIn = builtInWidgets[widget.type];
  if (BuiltIn) {
    return <BuiltIn {...(widget.data ?? {})} {...widget.config} />;
  }

  // Unknown widget type
  return (
    <div className="flex items-center justify-center h-full w-full text-xs text-gray-400 dark:text-gray-500">
      Unknown widget: {widget.type}
    </div>
  );
}
