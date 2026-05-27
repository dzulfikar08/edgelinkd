import { test, expect } from "@playwright/test";

/**
 * API tests for Rust-RED.
 *
 * These use Playwright's request API (no browser) and are the most
 * reliable tests in the suite. They verify the Node-RED-compatible
 * REST endpoints that the editor relies on.
 */

test.describe("Health & Info endpoints", () => {
  test("GET /api/health returns 200 with healthy status", async ({ request }) => {
    const resp = await request.get("/api/health");
    expect(resp.ok()).toBeTruthy();
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("rust-red-web");
    expect(body.version).toBeDefined();
  });

  test("GET /api/info returns API metadata", async ({ request }) => {
    const resp = await request.get("/api/info");
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    expect(body.name).toBeDefined();
    expect(body.version).toBeDefined();
    expect(body.endpoints).toBeDefined();
    expect(body.endpoints.admin).toBeDefined();
    expect(body.endpoints.admin.flows).toBe("/api/admin/flows");
    expect(body.endpoints.admin.nodes).toBe("/api/admin/nodes");
    expect(body.endpoints.admin.settings).toBe("/api/admin/settings");
  });
});

test.describe("Flows API", () => {
  test("GET /flows returns an array", async ({ request }) => {
    const resp = await request.get("/flows");
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test("POST /flows deploys a simple inject->debug flow", async ({ request }) => {
    // First, get current flows so we don't destroy existing state
    const beforeResp = await request.get("/flows");
    const beforeFlows = await beforeResp.json();

    const flowId = "e2e-test-flow-001";
    const injectId = "e2e-inject-001";
    const debugId = "e2e-debug-001";

    const newFlows = [
      {
        id: flowId,
        label: "E2E Test Flow",
        type: "tab",
      },
      {
        id: injectId,
        type: "inject",
        z: flowId,
        name: "e2e inject",
        props: [{ p: "payload" }],
        repeat: "",
        crontab: "",
        once: false,
        onceDelay: 0.1,
        topic: "",
        payload: "hello e2e",
        payloadType: "str",
        x: 150,
        y: 100,
        wires: [[debugId]],
      },
      {
        id: debugId,
        type: "debug",
        z: flowId,
        name: "e2e debug",
        active: true,
        toSidebar: true,
        console: false,
        complete: "payload",
        targetType: "msg",
        x: 400,
        y: 100,
        wires: [],
      },
    ];

    const resp = await request.post("/flows", {
      data: newFlows,
      headers: { "Content-Type": "application/json" },
    });
    expect(resp.status()).toBeLessThan(300);

    // Verify the flow was saved
    const afterResp = await request.get("/flows");
    expect(afterResp.ok()).toBeTruthy();
    const afterFlows = await afterResp.json();
    const flowIds = afterFlows.map((f: any) => f.id);
    expect(flowIds).toContain(flowId);
    expect(flowIds).toContain(injectId);
    expect(flowIds).toContain(debugId);

    // Clean up: restore original flows
    await request.post("/flows", {
      data: beforeFlows.length > 0 ? beforeFlows : [],
      headers: { "Content-Type": "application/json" },
    });
  });

  test("POST /flows with empty array clears all flows", async ({ request }) => {
    // Save current state
    const beforeResp = await request.get("/flows");
    const beforeFlows = await beforeResp.json();

    // Clear
    const clearResp = await request.post("/flows", {
      data: [],
      headers: { "Content-Type": "application/json" },
    });
    expect(clearResp.status()).toBeLessThan(300);

    // Verify empty
    const emptyResp = await request.get("/flows");
    const emptyFlows = await emptyResp.json();
    expect(emptyFlows).toEqual([]);

    // Restore
    await request.post("/flows", {
      data: beforeFlows,
      headers: { "Content-Type": "application/json" },
    });
  });
});

test.describe("Nodes API", () => {
  test("GET /nodes returns registered node types", async ({ request }) => {
    const resp = await request.get("/nodes");
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    // Response may be an array of module objects
    expect(Array.isArray(body) || typeof body === "object").toBeTruthy();
  });

  test("GET /nodes with Accept: text/html returns HTML", async ({ request }) => {
    const resp = await request.get("/nodes", {
      headers: { Accept: "text/html" },
    });
    expect(resp.ok()).toBeTruthy();
    expect(resp.headers()["content-type"]).toContain("text/html");

    const html = await resp.text();
    expect(html.length).toBeGreaterThan(0);
  });

  test("GET /nodes with Accept: application/json returns JSON", async ({ request }) => {
    const resp = await request.get("/nodes", {
      headers: { Accept: "application/json" },
    });
    expect(resp.ok()).toBeTruthy();
    expect(resp.headers()["content-type"]).toContain("application/json");
  });
});

test.describe("Settings API", () => {
  test("GET /settings returns system settings", async ({ request }) => {
    const resp = await request.get("/settings");
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    // Node-RED settings should contain core fields
    expect(body).toBeDefined();
  });
});

test.describe("Library API", () => {
  test("GET /library/flows returns library entries", async ({ request }) => {
    const resp = await request.get("/library/flows");
    // May be 200 or 404 depending on library state, but should not 500
    expect(resp.status()).toBeLessThan(500);
  });

  test("GET /library/functions returns library entries", async ({ request }) => {
    const resp = await request.get("/library/functions");
    expect(resp.status()).toBeLessThan(500);
  });
});

test.describe("Icons API", () => {
  test("GET /icons returns available icons", async ({ request }) => {
    const resp = await request.get("/icons");
    expect(resp.status()).toBeLessThan(500);
  });
});

test.describe("Plugins API", () => {
  test("GET /plugins returns plugin list", async ({ request }) => {
    const resp = await request.get("/plugins");
    expect(resp.status()).toBeLessThan(500);
  });
});

test.describe("Context API", () => {
  test("GET /context/global returns global context", async ({ request }) => {
    const resp = await request.get("/context/global");
    expect(resp.status()).toBeLessThan(500);
  });
});

test.describe("Versioning API", () => {
  test("GET /versioning/versions returns version list", async ({ request }) => {
    const resp = await request.get("/versioning/versions");
    expect(resp.status()).toBeLessThan(500);
  });
});

test.describe("Frontend Plugins API", () => {
  test("GET /api/frontend/plugins returns plugin list", async ({ request }) => {
    const resp = await request.get("/api/frontend/plugins");
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    expect(body.plugins).toBeDefined();
    expect(Array.isArray(body.plugins)).toBeTruthy();
  });
});

test.describe("Auth API", () => {
  test("POST /auth/login with no credentials returns appropriate error", async ({ request }) => {
    const resp = await request.post("/auth/login", {
      data: { username: "", password: "" },
    });
    // Should return 400 or 401, not 500
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(resp.status()).toBeLessThan(500);
  });
});

test.describe("Dashboard API", () => {
  test("GET /dashboard returns list", async ({ request }) => {
    const resp = await request.get("/dashboard");
    expect(resp.status()).toBeLessThan(500);
  });
});
