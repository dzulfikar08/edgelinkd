import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { clsx } from "clsx";

interface GenericNodeData {
  label: string;
  nodeType: string;
  color: string;
  inputs?: number;
  outputs?: number;
  [key: string]: unknown;
}

function GenericNodeRaw({ data, selected }: NodeProps) {
  const d = data as unknown as GenericNodeData;
  const inputCount = d.inputs ?? 1;
  const outputCount = d.outputs ?? 1;

  return (
    <div
      className={clsx(
        "rounded-md border-2 bg-white dark:bg-gray-800 min-w-[120px] max-w-[180px] shadow-sm transition-shadow",
        selected
          ? "border-blue-500 shadow-md"
          : "border-gray-300 dark:border-gray-600",
      )}
    >
      <div
        className="rounded-t-[4px] px-2 py-0.5 text-[11px] font-semibold text-white truncate"
        style={{ backgroundColor: d.color ?? "#a6bbcf" }}
      >
        {d.label || d.nodeType}
      </div>
      <div className="px-2 py-1 text-[11px] text-gray-600 dark:text-gray-300 truncate">
        {d.nodeType}
      </div>

      {Array.from({ length: inputCount }).map((_, i) => (
        <Handle
          key={`in-${i}`}
          type="target"
          position={Position.Left}
          id={`in-${i}`}
          style={{
            top: `${((i + 1) / (inputCount + 1)) * 100}%`,
            width: 12,
            height: 12,
            minWidth: 12,
            minHeight: 12,
          }}
          className="!bg-gray-500 !border-white touch-handle"
        />
      ))}

      {Array.from({ length: outputCount }).map((_, i) => (
        <Handle
          key={`out-${i}`}
          type="source"
          position={Position.Right}
          id={`out-${i}`}
          style={{
            top: `${((i + 1) / (outputCount + 1)) * 100}%`,
            width: 12,
            height: 12,
            minWidth: 12,
            minHeight: 12,
          }}
          className="!bg-gray-500 !border-white touch-handle"
        />
      ))}
    </div>
  );
}

export const GenericNode = memo(GenericNodeRaw);
