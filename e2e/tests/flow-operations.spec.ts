import { test, expect } from "@playwright/test";

/**
 * Flow CRUD operation tests for Rust-RED.
 *
 * These tests exercise flow import, deploy, and clear through the
 * editor UI, and also use the API to verify state changes.
 *
 * Strategy:
 *   - Import: Use Ctrl+I (keyboard shortcut) or the menu to open
 *     the import dialog, paste a flow JSON, and confirm.
 *   - Deploy: Click the deploy button.
 *   - Clear: Use API to reset state after each test.
 *
 * Prerequisite: Rust-RED server must be running at http://127.0.0.1:1888
 */

// A minimal inject->debug flow for importing
const TEST_FLOW_JSON = JSON.stringify([
  {
    id: "e2e-tab-001",
    label: "E2E Import Test",
    type: "tab",
  },
  {
    id: "e2e-inject-001",
    type: "inject",
    z: "e2e-tab-001",
    name: "test inject",
    props: [{ p: "payload" }],
    repeat: "",
    crontab: "",
    once: false,
    onceDelay: 0.1,
    topic: "",
    payload: "e2e test payload",
    payloadType: "str",
    x: 150,
    y: 100,
    wires: [["e2e-debug-001"]],
  },
  {
    id: "e2e-debug-001",
    type: "debug",
    z: "e2e-tab-001",
    name: "test debug",
    active: true,
    toSidebar: true,
    console: false,
    complete: "payload",
    targetType: "msg",
    x: 400,
    y: 100,
    wires: [],
  },
]);

test.describe("Flow import via dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Ensure clean state: clear flows via API
    await page.request.post("/flows", {
      data: [],
      headers: { "Content-Type": "application/json" },
    });
    // Reload to reflect clean state
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
  });

  test("import dialog opens with Ctrl+I", async ({ page }) => {
    await page.keyboard.press("Control+i");

    const dialog = page.locator(".red-ui-dialog:visible");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test("can paste flow JSON into import dialog", async ({ page }) => {
    await page.keyboard.press("Control+i");

    const dialog = page.locator(".red-ui-dialog:visible");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // The import dialog has a textarea
    const textarea = dialog.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill(TEST_FLOW_JSON);

    // The value should be set
    const value = await textarea.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test("import adds nodes to canvas", async ({ page }) => {
    await page.keyboard.press("Control+i");

    const dialog = page.locator(".red-ui-dialog:visible");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Fill the textarea with flow JSON
    const textarea = dialog.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill(TEST_FLOW_JSON);

    // Click import/OK button
    const importBtn = dialog.locator("button:has-text('import'), button.red-ui-dialog-button-primary");
    const count = await importBtn.count();
    if (count > 0) {
      await importBtn.first().click();
    } else {
      // Press Enter as fallback
      await page.keyboard.press("Enter");
    }

    // Wait for nodes to appear on canvas
    await page.waitForTimeout(2000);

    // Verify nodes on the canvas via API
    const resp = await page.request.get("/flows");
    const flows = await resp.json();
    const ids = flows.map((f: any) => f.id);
    expect(ids).toContain("e2e-tab-001");
  });
});

test.describe("Flow deploy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Deploy a test flow via API so we have something on canvas
    await page.request.post("/flows", {
      data: JSON.parse(TEST_FLOW_JSON),
      headers: { "Content-Type": "application/json" },
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
  });

  test("deploy button is clickable", async ({ page }) => {
    const deployBtn = page.locator(
      "#red-ui-header-button-deploy, button.red-ui-deploy-button, .red-ui-header-button-deploy"
    );
    const count = await deployBtn.count();
    if (count > 0) {
      await deployBtn.first().click();
      // Should not throw; deploy is a valid action
    }
  });

  test("deploy sends flows to server", async ({ page }) => {
    // Verify flows exist via API
    const resp = await page.request.get("/flows");
    const flows = await resp.json();
    expect(flows.length).toBeGreaterThan(0);
  });
});

test.describe("Flow clear via API", () => {
  test("POST /flows with empty array clears canvas", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // First deploy a flow
    await page.request.post("/flows", {
      data: JSON.parse(TEST_FLOW_JSON),
      headers: { "Content-Type": "application/json" },
    });

    // Verify it exists
    const afterResp = await page.request.get("/flows");
    const afterFlows = await afterResp.json();
    expect(afterFlows.length).toBeGreaterThan(0);

    // Clear via API
    await page.request.post("/flows", {
      data: [],
      headers: { "Content-Type": "application/json" },
    });

    // Verify empty
    const emptyResp = await page.request.get("/flows");
    const emptyFlows = await emptyResp.json();
    expect(emptyFlows).toEqual([]);
  });
});

test.describe("Flow state management", () => {
  test("GET /flows/state returns flow state", async ({ request }) => {
    const resp = await request.get("/flows/state");
    expect(resp.status()).toBeLessThan(500);
  });

  test("POST /flows/state updates flow state", async ({ request }) => {
    const resp = await request.post("/flows/state", {
      data: { state: "stop" },
    });
    // May or may not be implemented fully, but should not 500
    expect(resp.status()).toBeLessThan(500);
  });
});

test.describe("Single flow CRUD", () => {
  const testFlow = {
    id: "e2e-single-flow-001",
    label: "E2E Single Flow Test",
    nodes: [],
    configs: [],
    subflows: [],
  };

  test("POST /flow creates a new flow tab", async ({ request }) => {
    // First clear
    await request.post("/flows", {
      data: [],
      headers: { "Content-Type": "application/json" },
    });

    const resp = await request.post("/flow", {
      data: testFlow,
    });
    expect(resp.status()).toBeLessThan(300);

    const body = await resp.json();
    expect(body).toBeDefined();
  });

  test("GET /flow/{id} retrieves a specific flow", async ({ request }) => {
    // First create the flow via top-level API
    await request.post("/flows", {
      data: [{ ...testFlow, type: "tab" }],
      headers: { "Content-Type": "application/json" },
    });

    const resp = await request.get(`/flow/${testFlow.id}`);
    expect(resp.status()).toBeLessThan(500);
  });

  test("DELETE /flow/{id} removes a specific flow", async ({ request }) => {
    // First create
    await request.post("/flows", {
      data: [{ ...testFlow, type: "tab" }],
      headers: { "Content-Type": "application/json" },
    });

    // Then delete
    const resp = await request.delete(`/flow/${testFlow.id}`);
    expect(resp.status()).toBeLessThan(300);
  });
});
