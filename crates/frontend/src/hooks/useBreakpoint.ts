import { useState, useEffect } from "react";

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl";

const QUERIES: Record<Breakpoint, string> = {
  xs: "(min-width: 320px)",
  sm: "(min-width: 480px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
};

function getBreakpoint(): Breakpoint {
  if (typeof window === "undefined") return "lg";
  const w = window.innerWidth;
  if (w >= 1280) return "xl";
  if (w >= 1024) return "lg";
  if (w >= 768) return "md";
  if (w >= 480) return "sm";
  return "xs";
}

export function useBreakpoint() {
  const [bp, setBp] = useState<Breakpoint>(getBreakpoint);

  useEffect(() => {
    const mqls = Object.values(QUERIES).map((q) => window.matchMedia(q));
    const handler = () => setBp(getBreakpoint());
    mqls.forEach((m) => m.addEventListener("change", handler));
    return () => mqls.forEach((m) => m.removeEventListener("change", handler));
  }, []);

  return {
    breakpoint: bp,
    isMobile: bp === "xs" || bp === "sm",
    isTablet: bp === "md",
    isDesktop: bp === "lg" || bp === "xl",
    isTouch: bp === "xs" || bp === "sm" || bp === "md",
  };
}
