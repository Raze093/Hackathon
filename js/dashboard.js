// dashboard.js — overview of entrance queues and floor availability

function mountDashboardView(container) {
  container.className = "app-view dashboard-page";
  container.innerHTML = `
    <header class="dashboard-header">
      <h1 class="dashboard-title">Dashboard</h1>
      <p class="dashboard-subtitle">
        Live overview · <span id="dashboardTimestamp">Loading…</span>
      </p>
    </header>

    <section class="dashboard-section" aria-labelledby="entranceHeading">
      <h2 id="entranceHeading" class="section-heading">Parking entrance queues</h2>
      <p class="section-note">Cars waiting to enter (1st &amp; 2nd floor entrances)</p>
      <div class="entrance-queue-grid">
        <article class="entrance-card">
          <p class="entrance-floor-label">1st Floor</p>
          <h3 class="entrance-title">Parking Entrance</h3>
          <p class="queue-count" id="queueL1">—</p>
          <p class="queue-label">cars in queue</p>
        </article>
        <article class="entrance-card">
          <p class="entrance-floor-label">2nd Floor</p>
          <h3 class="entrance-title">Parking Entrance</h3>
          <p class="queue-count" id="queueL2">—</p>
          <p class="queue-label">cars in queue</p>
        </article>
      </div>
    </section>

    <section class="dashboard-section" aria-labelledby="availabilityHeading">
      <h2 id="availabilityHeading" class="section-heading">Available parking by floor</h2>
      <div id="floorAvailabilityGrid" class="floor-availability-grid"></div>
    </section>
  `;
}

function renderDashboard(snapshot) {
  const { floors, entranceQueues, latestLiveInfo } = snapshot;

  const l1Queue = document.getElementById("queueL1");
  const l2Queue = document.getElementById("queueL2");
  if (l1Queue) {
    l1Queue.textContent = entranceQueues.l1;
  }
  if (l2Queue) {
    l2Queue.textContent = entranceQueues.l2;
  }

  const timestampEl = document.getElementById("dashboardTimestamp");
  if (timestampEl) {
    timestampEl.textContent = latestLiveInfo.timestamp;
  }

  const grid = document.getElementById("floorAvailabilityGrid");
  if (!grid) {
    return;
  }

  grid.innerHTML = floors
    .map((floor) => {
      const available = countAvailableLots(floor);
      const total = getNormalLots(floor).length;

      return `
        <article class="floor-avail-card">
          <h3 class="floor-avail-name">${floor.name}</h3>
          <p class="floor-avail-count">${available}</p>
          <p class="floor-avail-label">spots available</p>
          <p class="floor-avail-meta">${available} of ${total} parking bays</p>
        </article>
      `;
    })
    .join("");
}
