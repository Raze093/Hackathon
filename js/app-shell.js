// app-shell.js — sidebar navigation for logged-in pages

function initAppShell() {
  const logoutBtn = document.getElementById("sidebarLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  initSidebarToggle();
}

function bindSimulationResetButton() {
  const button = document.getElementById("simulationResetBtn");
  if (!button || button.dataset.bound === "true") {
    return;
  }

  button.dataset.bound = "true";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await ParkingSimulation.reset();
    } finally {
      button.disabled = false;
    }
  });
}

function setActiveNavPage(activePage) {
  document.querySelectorAll(".sidebar-nav-link").forEach((link) => {
    const page = link.dataset.page;
    const isActive = page === activePage;

    link.classList.toggle("active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function initSidebarToggle() {
  const layout = document.querySelector(".app-layout");
  const toggle = document.getElementById("sidebarToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  const desktopQuery = window.matchMedia("(min-width: 821px)");

  if (!layout || !toggle) {
    return;
  }

  function setSidebarOpen(open) {
    layout.classList.toggle("sidebar-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");

    if (backdrop) {
      backdrop.hidden = !open;
    }
  }

  function applyDefaultSidebarState() {
    setSidebarOpen(desktopQuery.matches);
  }

  toggle.addEventListener("click", () => {
    setSidebarOpen(!layout.classList.contains("sidebar-open"));
  });

  backdrop?.addEventListener("click", () => {
    setSidebarOpen(false);
  });

  desktopQuery.addEventListener("change", applyDefaultSidebarState);
  applyDefaultSidebarState();
}
