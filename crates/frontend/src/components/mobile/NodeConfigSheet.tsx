import { useState, useCallback, useEffect } from "react";
import type { Node } from "@xyflow/react";
import { BottomSheet, SidePanel } from "./BottomSheet";

interface NodeConfigSheetProps {
  node: Node | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, data: Record<string, unknown>) => void;
}

export function NodeConfigSheet({ node, open, onClose, onSave }: NodeConfigSheetProps) {
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && node?.data) {
      const d = node.data as Record<string, unknown>;
      setForm(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v)])));
    }
  }, [open, node]);

  const handleSave = useCallback(() => {
    if (node) {
      onSave(node.id, form);
      onClose();
    }
  }, [node, form, onSave, onClose]);

  if (!node) return null;

  const d = node.data as Record<string, unknown>;

  return (
    <>
      <BottomSheet
        open={open && !!node}
        onClose={onClose}
        title={`Edit: ${d.label || node.type}`}
      >
        <div className="p-4 space-y-4">
          <NodeConfigForm data={d} form={form} onChange={setForm} />
          <div className="flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-3 rounded-lg text-sm font-medium text-white active:opacity-90"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Save
            </button>
          </div>
        </div>
      </BottomSheet>
      <SidePanel open={open && !!node} onClose={onClose} title={`Edit: ${d.label || node.type}`}>
        <div className="p-4 space-y-4">
          <NodeConfigForm data={d} form={form} onChange={setForm} />
          <div className="flex gap-3 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Save
            </button>
          </div>
        </div>
      </SidePanel>
    </>
  );
}

function NodeConfigForm({
  data,
  form,
  onChange,
}: {
  data: Record<string, unknown>;
  form: Record<string, string>;
  onChange: (f: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, value]) => {
        if (key === "color" || key === "inputs" || key === "outputs") return null;
        return (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 capitalize">
              {key.replace(/([A-Z])/g, " $1").trim()}
            </label>
            <input
              type="text"
              value={form[key] ?? String(value)}
              onChange={(e) => onChange({ ...form, [key]: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] min-h-[44px]"
            />
          </div>
        );
      })}
    </div>
  );
}
