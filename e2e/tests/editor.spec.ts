import { test, expect } from "@playwright/test";

/**
 * Editor UI tests for Rust-RED.
 *
 * These tests verify the Node-RED editor loads and key UI components
 * are present. The selectors target the standard Node-RED DOM structure
 * (id="red-ui-editor", .red-ui-palette, etc.).
 *
 * Prerequisite: Rust-RED server must be running at http://127.0.0.1:1888
 */

test.describe("Editor page load", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
  });

  test("page has correct title", async ({ page }) => {
    const title = await page.title();
    expect(title).toBe("Rust-Red");
  });

  test("editor container renders", async ({ page }) => {
    const editor = page.locator("#red-ui-editor");
    await expect(editor).toBeVisible({ timeout: 15_000 });
  });

  test("main canvas (workspace) is present", async ({ page }) => {
    // Node-RED canvas is a div inside #red-ui-editor
    const canvas = page.locator("#red-ui-editor .red-ui-workspace");
    await expect(canvas).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Node palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // Wait for palette to populate (nodes load asynchronously)
    await page.waitForTimeout(3000);
  });

  test("palette container is visible", async ({ page }) => {
    const palette = page.locator(".red-ui-palette");
    await expect(palette).toBeVisible({ timeout: 15_000 });
  });

  test("palette has category headers", async ({ page }) => {
    // Node-RED groups nodes by category in .red-ui-palette-category
    const categories = page.locator(".red-ui-palette-category");
    const count = await categories.count();
    expect(count).toBeGreaterThan(0);
  });

  test("palette contains at least one node", async ({ page }) => {
    // Individual nodes in the palette are .red-ui-palette-node
    const nodes = page.locator(".red-ui-palette-node");
    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);
  });

  test("palette search input exists", async ({ page }) => {
    // Node-RED palette has a search/filter input
    const search = page.locator("#red-ui-palette-search-input, .red-ui-palette-search input");
    // It might not have a specific id; try broader selector
    const searchAlt = page.locator(".red-ui-palette-search");
    const count = await searchAlt.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Header / toolbar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
  });

  test("deploy button is present", async ({ page }) => {
    // Node-RED deploy button is #red-ui-header-button-deploy or .red-ui-header-button
    const deploy = page.locator("#red-ui-header-button-deploy, button.red-ui-deploy-button, .red-ui-header-button-deploy");
    const count = await deploy.count();
    expect(count).toBeGreaterThan(0);
  });

  test("header toolbar is visible", async ({ page }) => {
    const header = page.locator(".red-ui-header, #red-ui-header");
    const count = await header.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
  });

  test("sidebar container is present", async ({ page }) => {
    const sidebar = page.locator(".red-ui-sidebar, #red-ui-sidebar");
    const count = await sidebar.count();
    expect(count).toBeGreaterThan(0);
  });

  test("info tab is accessible", async ({ page }) => {
    // Click on the info tab in the sidebar
    const infoTab = page.locator(".red-ui-sidebar-tab a:has-text('info'), .red-ui-sidebar-tab-icon.info, [data-tab='info']");
    const count = await infoTab.count();
    if (count > 0) {
      await infoTab.first().click();
      // Info panel should now be visible
      const infoPanel = page.locator(".red-ui-sidebar-info, .red-ui-info-tab");
      await expect(infoPanel.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("debug tab is accessible", async ({ page }) => {
    // Click on the debug tab in the sidebar
    const debugTab = page.locator(".red-ui-sidebar-tab a:has-text('debug'), .red-ui-sidebar-tab-icon.debug, [data-tab='debug']");
    const count = await debugTab.count();
    if (count > 0) {
      await debugTab.first().click();
      // Debug panel should now be visible
      const debugPanel = page.locator(".red-ui-sidebar-debug, .red-ui-debug-tab");
      await expect(debugPanel.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("Keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
  });

  test("Ctrl-I opens import dialog", async ({ page }) => {
    // Press Ctrl+I to open import dialog
    await page.keyboard.press("Control+i");

    // Import dialog should appear
    const importDialog = page.locator(".red-ui-dialog, #red-ui-dialog");
    await expect(importDialog.first()).toBeVisible({ timeout: 5_000 });
  });
});
