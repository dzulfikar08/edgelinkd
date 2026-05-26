/*
  RustRED Mobile JS — Overlay for Original Node-RED Editor
  Adds bottom tab bar, slide-in palette, bottom-sheet sidebar,
  hamburger menu, FAB, and touch enhancements.
*/
(function () {
  "use strict";

  var MOBILE_BREAKPOINT = 768;
  var isMobile = window.innerWidth < MOBILE_BREAKPOINT;

  // ------------------------------------------------------------------
  // DOM helpers
  // ------------------------------------------------------------------
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  // ------------------------------------------------------------------
  // Wait for the editor to fully load, then call init()
  // ------------------------------------------------------------------
  function waitForEditor() {
    var container = $("#red-ui-main-container");
    if (container && !container.classList.contains("hide")) {
      setTimeout(function () { init(); }, 100);
      return;
    }
    requestAnimationFrame(waitForEditor);
  }

  // ------------------------------------------------------------------
  // Force Node-RED into a mobile-friendly state
  // ------------------------------------------------------------------
  function forceMobileLayout() {
    // Close palette and sidebar via Node-RED API if available
    if (typeof RED !== "undefined") {
      try { RED.menu.setSelected("menu-item-palette", false); } catch (e) {}
      try { RED.menu.setSelected("menu-item-sidebar", false); } catch (e) {}
    }

    // Force workspace to full-width
    resetWorkspace();

    // Hide palette and sidebar separators
    var ps = $("#red-ui-palette-separator");
    if (ps) ps.style.display = "none";
    var ss = $("#red-ui-sidebar-separator");
    if (ss) ss.style.display = "none";
  }

  function resetWorkspace() {
    var workspace = $("#red-ui-workspace");
    if (workspace) {
      workspace.style.left = "0px";
      workspace.style.right = "0px";
    }

    // Also reset the main container
    var mc = $("#red-ui-main-container");
    if (mc) {
      mc.classList.remove("red-ui-palette-closed");
      mc.classList.remove("red-ui-sidebar-closed");
    }
  }

  // ------------------------------------------------------------------
  // Hook into Node-RED resize events to re-apply mobile overrides
  // ------------------------------------------------------------------
  function hookResizeEvents() {
    if (typeof RED === "undefined") return;

    // Node-RED fires this whenever sidebar or palette is toggled/resized
    try {
      RED.events.on("sidebar:resize", function () {
        if (!isMobile) return;
        // Re-apply full-width workspace after Node-RED resets inline styles
        setTimeout(resetWorkspace, 50);
      });
    } catch (e) {}

    // Also watch for workspace tab changes
    try {
      RED.events.on("workspace:change", function () {
        if (!isMobile) return;
        setTimeout(resetWorkspace, 50);
      });
    } catch (e) {}
  }

  // ------------------------------------------------------------------
  // Overlay backdrop
  // ------------------------------------------------------------------
  var overlay;

  function createOverlay() {
    overlay = document.createElement("div");
    overlay.className = "red-ui-mobile-overlay";
    overlay.id = "red-ui-mobile-overlay";
    overlay.addEventListener("click", function () {
      closePalette();
      closeSidebar();
    });
    document.body.appendChild(overlay);
  }

  function showOverlay() { if (overlay) overlay.classList.add("active"); }
  function hideOverlay() { if (overlay) overlay.classList.remove("active"); }

  // ------------------------------------------------------------------
  // Palette (left) open / close
  // ------------------------------------------------------------------
  function openPalette() {
    var el = $("#red-ui-palette");
    if (!el) return;
    closeSidebar();
    el.classList.add("red-ui-palette-mobile-open");
    showOverlay();
    setActiveTab("palette");
  }

  function closePalette() {
    var el = $("#red-ui-palette");
    if (el) el.classList.remove("red-ui-palette-mobile-open");
    hideOverlay();
  }

  function isPaletteOpen() {
    var el = $("#red-ui-palette");
    return el && el.classList.contains("red-ui-palette-mobile-open");
  }

  // ------------------------------------------------------------------
  // Sidebar (right) open / close
  // ------------------------------------------------------------------
  function openSidebar() {
    var el = $("#red-ui-sidebar");
    if (!el) return;
    closePalette();
    el.classList.add("red-ui-sidebar-mobile-open");
    showOverlay();
  }

  function closeSidebar() {
    var el = $("#red-ui-sidebar");
    if (el) el.classList.remove("red-ui-sidebar-mobile-open");
    hideOverlay();
  }

  function isSidebarOpen() {
    var el = $("#red-ui-sidebar");
    return el && el.classList.contains("red-ui-sidebar-mobile-open");
  }

  function activateSidebarTab(tabName) {
    openSidebar();
    // Wait for sidebar to be visible, then click the matching tab
    setTimeout(function () {
      var tabs = $$("#red-ui-sidebar .red-ui-tab");
      tabs.forEach(function (tab) {
        var label = (tab.textContent || "").trim().toLowerCase();
        if (label.indexOf(tabName) !== -1) {
          tab.click();
        }
      });
    }, 50);
  }

  // ------------------------------------------------------------------
  // Hamburger button in header
  // ------------------------------------------------------------------
  function addHamburger() {
    var header = $("#red-ui-header");
    if (!header) return;

    var btn = document.createElement("button");
    btn.className = "red-ui-mobile-hamburger";
    btn.setAttribute("aria-label", "Open node palette");
    btn.innerHTML = '<i class="fa fa-bars"></i>';

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (isPaletteOpen()) closePalette();
      else openPalette();
    });

    var toolbar = header.querySelector(".red-ui-header-toolbar");
    if (toolbar) {
      toolbar.insertBefore(btn, toolbar.firstChild);
    }
  }

  // ------------------------------------------------------------------
  // FAB (floating action button)
  // ------------------------------------------------------------------
  function addFAB() {
    var fab = document.createElement("button");
    fab.className = "red-ui-mobile-fab";
    fab.setAttribute("aria-label", "Quick add node");
    fab.innerHTML = '<i class="fa fa-plus"></i>';

    fab.addEventListener("click", function () {
      if (isPaletteOpen()) closePalette();
      else openPalette();
    });

    document.body.appendChild(fab);
  }

  // ------------------------------------------------------------------
  // Bottom tab bar
  // ------------------------------------------------------------------
  var currentTab = "flows";
  var tabBar;

  function addBottomTabBar() {
    tabBar = document.createElement("nav");
    tabBar.className = "red-ui-mobile-tabbar";
    tabBar.id = "red-ui-mobile-tabbar";

    var tabs = [
      { id: "flows", icon: "fa-random", label: "Flows" },
      { id: "palette", icon: "fa-th-large", label: "Nodes" },
      { id: "debug", icon: "fa-bug", label: "Debug" },
      { id: "info", icon: "fa-info-circle", label: "Info" },
      { id: "settings", icon: "fa-cog", label: "Settings" },
    ];

    tabs.forEach(function (tab) {
      var btn = document.createElement("button");
      btn.setAttribute("data-tab", tab.id);
      btn.setAttribute("aria-label", tab.label);

      var icon = document.createElement("i");
      icon.className = "fa " + tab.icon;
      btn.appendChild(icon);

      var span = document.createElement("span");
      span.textContent = tab.label;
      btn.appendChild(span);

      if (tab.id === currentTab) btn.classList.add("active");

      btn.addEventListener("click", function () {
        handleTabClick(tab.id);
      });

      tabBar.appendChild(btn);
    });

    document.body.appendChild(tabBar);
  }

  function setActiveTab(tabId) {
    currentTab = tabId;
    if (!tabBar) return;
    tabBar.querySelectorAll("button").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });
  }

  function handleTabClick(tabId) {
    closePalette();
    closeSidebar();

    switch (tabId) {
      case "flows":
        // Just close everything, canvas is visible
        break;
      case "palette":
        openPalette();
        break;
      case "debug":
        activateSidebarTab("debug");
        break;
      case "info":
        activateSidebarTab("info");
        break;
      case "settings":
        if (typeof RED !== "undefined" && RED.actions) {
          RED.actions.invoke("core:manage-user-settings");
        }
        break;
    }

    setActiveTab(tabId);
  }

  // ------------------------------------------------------------------
  // Touch: swipe on sidebar
  // ------------------------------------------------------------------
  function hookSidebarSwipe() {
    var sidebar = $("#red-ui-sidebar");
    if (!sidebar) return;

    var startY = 0;
    var wasOpen = false;

    sidebar.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) {
        startY = e.touches[0].clientY;
        wasOpen = isSidebarOpen();
      }
    }, { passive: true });

    sidebar.addEventListener("touchmove", function (e) {
      if (e.touches.length === 1) {
        var dy = e.touches[0].clientY - startY;
        if (dy < -50 && !wasOpen) {
          openSidebar();
          wasOpen = true;
        } else if (dy > 80 && wasOpen) {
          closeSidebar();
          setActiveTab("flows");
          wasOpen = false;
        }
      }
    }, { passive: true });
  }

  // ------------------------------------------------------------------
  // Touch: long-press on canvas for context menu
  // ------------------------------------------------------------------
  function hookCanvasLongPress() {
    var canvas = $("#red-ui-workspace-chart");
    if (!canvas) return;

    var timer;

    canvas.addEventListener("touchstart", function (e) {
      timer = setTimeout(function () {
        var touch = e.touches[0];
        var evt = new MouseEvent("contextmenu", {
          bubbles: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
        canvas.dispatchEvent(evt);
      }, 600);
    }, { passive: true });

    canvas.addEventListener("touchmove", function () {
      clearTimeout(timer);
    }, { passive: true });

    canvas.addEventListener("touchend", function () {
      clearTimeout(timer);
    }, { passive: true });
  }

  // ------------------------------------------------------------------
  // Resize handler
  // ------------------------------------------------------------------
  function onResize() {
    var wasMobile = isMobile;
    isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (wasMobile !== isMobile) {
      location.reload();
    }
  }

  // ------------------------------------------------------------------
  // Main init
  // ------------------------------------------------------------------
  function init() {
    if (!isMobile) return;

    createOverlay();
    addBottomTabBar();
    addHamburger();
    addFAB();

    // Force layout after a short delay to let Node-RED finish its own setup
    setTimeout(function () {
      forceMobileLayout();
      hookResizeEvents();
      hookSidebarSwipe();
      hookCanvasLongPress();
    }, 200);

    window.addEventListener("resize", onResize);
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      waitForEditor();
    });
  } else {
    waitForEditor();
  }
})();
