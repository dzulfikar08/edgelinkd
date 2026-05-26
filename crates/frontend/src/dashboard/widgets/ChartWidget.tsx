import { useRef, useEffect } from "react";

interface DataPoint {
  t: number;
  v: number;
}

interface ChartWidgetProps {
  data?: DataPoint[];
  label?: string;
  color?: string;
}

export function ChartWidget({ data = [], label, color = "#3b82f6" }: ChartWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    if (data.length < 2) {
      ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("color") || "#999";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data", w / 2, h / 2);
      return;
    }

    const padL = 4;
    const padR = 4;
    const padT = 8;
    const padB = 8;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;

    const values = data.map((d) => d.v);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const rangeV = maxV - minV || 1;

    const toX = (i: number) => padL + (i / (data.length - 1)) * chartW;
    const toY = (v: number) => padT + chartH - ((v - minV) / rangeV) * chartH;

    // Draw fill
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0].v));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(toX(i), toY(data[i].v));
    }
    ctx.lineTo(toX(data.length - 1), padT + chartH);
    ctx.lineTo(toX(0), padT + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, color + "40");
    grad.addColorStop(1, color + "05");
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0].v));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(toX(i), toY(data[i].v));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
  }, [data, color]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-2">
      {label && (
        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 text-center truncate w-full">
          {label}
        </span>
      )}
      <canvas ref={canvasRef} className="w-full flex-1 min-h-0" />
    </div>
  );
}
