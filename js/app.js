// app.js — single-page shell; sidebar stays mounted, views swap in #appView

requireLogin();

const PAGE_TITLES = {
  dashboard: "Queensbay Mall Parking | Dashboard",
  map: "Queensbay Mall Parking Availability | Map",
};

let currentPage = null;
let viewUnsubscribe = null;

function getPageFromHash() {
  const hash = location.hash.replace(/^#\/?/, "").toLowerCase();
  return hash === "map" ? "map" : "dashboard";
}

function teardownView() {
  if (viewUnsubscribe) {
    viewUnsubscribe();
    viewUnsubscribe = null;
  }
}

function closeSidebarOnMobile() {
  const layout = document.querySelector(".app-layout");
  if (layout && window.matchMedia("(max-width: 820px)").matches) {
    layout.classList.remove("sidebar-open");
    const toggle = document.getElementById("sidebarToggle");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    }
    if (backdrop) {
      backdrop.hidden = true;
    }
  }
}

function navigate(page, { replace = false } = {}) {
  const nextPage = page === "map" ? "map" : "dashboard";

  if (nextPage === currentPage) {
    return;
  }

  teardownView();

  const view = document.getElementById("appView");
  if (!view) {
    return;
  }

  currentPage = nextPage;
  document.title = PAGE_TITLES[nextPage];
  setActiveNavPage(nextPage);

  if (nextPage === "dashboard") {
    mountDashboardView(view);
    viewUnsubscribe = ParkingSimulation.subscribe(renderDashboard);
  } else {
    mountMapView(view);
    viewUnsubscribe = ParkingSimulation.subscribe(onSimulationUpdate);
  }

  const hash = nextPage === "map" ? "#/map" : "#/dashboard";
  const url = `app.html${hash}`;

  if (replace) {
    history.replaceState({ page: nextPage }, "", url);
  } else {
    history.pushState({ page: nextPage }, "", url);
  }
}

function initRouter() {
  document.querySelectorAll(".sidebar-nav-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.dataset.page);
      closeSidebarOnMobile();
    });
  });

  window.addEventListener("popstate", (event) => {
    const page = event.state?.page || getPageFromHash();
    currentPage = null;
    navigate(page, { replace: true });
  });
}

initAppShell();
initRouter();
ParkingSimulation.start();

navigate(getPageFromHash(), { replace: true });
