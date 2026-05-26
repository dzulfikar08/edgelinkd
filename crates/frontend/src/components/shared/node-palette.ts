export interface PaletteNode {
  type: string;
  label: string;
  color: string;
}

export interface Category {
  name: string;
  label: string;
  nodes: PaletteNode[];
}

export const categories: Category[] = [
  {
    name: "common",
    label: "Common",
    nodes: [
      { type: "inject", label: "inject", color: "#a6bbcf" },
      { type: "debug", label: "debug", color: "#87a669" },
      { type: "comment", label: "comment", color: "#ffffff" },
      { type: "link-in", label: "link in", color: "#ddd" },
      { type: "link-out", label: "link out", color: "#ddd" },
    ],
  },
  {
    name: "function",
    label: "Function",
    nodes: [
      { type: "function", label: "function", color: "#fdd0a2" },
      { type: "switch", label: "switch", color: "#e2d96e" },
      { type: "change", label: "change", color: "#e2d96e" },
      { type: "template", label: "template", color: "#e2d96e" },
      { type: "delay", label: "delay", color: "#e2d96e" },
    ],
  },
  {
    name: "network",
    label: "Network",
    nodes: [
      { type: "http-in", label: "http in", color: "#c1977b" },
      { type: "http-response", label: "http response", color: "#c1977b" },
      { type: "http-request", label: "http request", color: "#e2d96e" },
      { type: "websocket-in", label: "websocket in", color: "#c1977b" },
      { type: "websocket-out", label: "websocket out", color: "#c1977b" },
      { type: "mqtt-in", label: "mqtt in", color: "#c1977b" },
      { type: "mqtt-out", label: "mqtt out", color: "#c1977b" },
    ],
  },
  {
    name: "storage",
    label: "Storage",
    nodes: [
      { type: "file", label: "file", color: "#e2d96e" },
      { type: "file-in", label: "file in", color: "#e2d96e" },
    ],
  },
  {
    name: "parser",
    label: "Parser",
    nodes: [
      { type: "json", label: "json", color: "#e2d96e" },
      { type: "xml", label: "xml", color: "#e2d96e" },
      { type: "csv", label: "csv", color: "#e2d96e" },
      { type: "html", label: "html", color: "#e2d96e" },
    ],
  },
];
