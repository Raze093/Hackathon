// main.js
// Main parking map page logic.

let floors = ParkingSimulation.getFloors();
let latestRowsBySpot = new Map();
let latestLiveInfo = {
  timestamp: "Loading CSV...",
  carsEntered: "-",
  isPeakHour: "-",
  isWeekend: "-",
  rowsLoaded: 0,
  matchedSpots: 0,
  missingSpots: 0,
};

// Stores the clicked available parking spot.
// The estimated available time bubble appears only on this selected spot.
let selectedSpot = null;

function onSimulationUpdate(snapshot) {
  floors = snapshot.floors;
  latestRowsBySpot = snapshot.latestRowsBySpot;
  latestLiveInfo = snapshot.latestLiveInfo;

  if (selectedSpot) {
    const selectedFloor = floors.find(
      (floor) => floor.id === selectedSpot.floorId,
    );
    const selectedLot = selectedFloor
      ? allLots(selectedFloor).find((lot) => lot.id === selectedSpot.spotId)
      : null;

    if (!selectedLot || selectedLot.status !== "available") {
      selectedSpot = null;
    }
  }

  renderFloors();
}

function estimateAvailableTimeMinutes(spotId = null) {
  // If a CSV row exists for this exact spot, use the dataset's estimated value.
  if (spotId && latestRowsBySpot.has(spotId)) {
    const row = latestRowsBySpot.get(spotId);
    const csvEstimate = Number(row.estimated_time_avail_min);

    if (Number.isFinite(csvEstimate)) {
      return csvEstimate;
    }
  }

  // Fallback estimate if there is no matching CSV row.
  const avgDuration = 120;
  const occupied = Math.max(1, countTotalOccupied(floors));
  const base = avgDuration / occupied;
  const buffer = Math.max(0.55, 1 - countTotalAvailable(floors) * 0.015);

  return Math.max(1, Math.round(base * buffer));
}

function getSpotTimeLabel(spotId) {
  const row = latestRowsBySpot.get(spotId);

  if (row && row.estimated_time_label) {
    return row.estimated_time_label;
  }

  return `${estimateAvailableTimeMinutes(spotId)} min`;
}

function toggleFloor(floorId) {
  // Mutate the simulation's floor list in place — replacing the array with .map()
  // left the CSV tick handler overwriting open/closed state every few seconds.
  floors = ParkingSimulation.getFloors();
  const floor = floors.find((item) => item.id === floorId);
  if (floor) {
    floor.open = !floor.open;
  }

  selectedSpot = null;
  saveLots(floors);
  renderFloors();
}

function toggleLot(floorId, lotId) {
  floors = ParkingSimulation.getFloors();
  const floor = floors.find((item) => item.id === floorId);
  const skipStatuses = [
    "disabled",
    "entrance",
    "hatch",
    "lift-box",
    "stairs-box",
  ];
  const lot = allLots(floor).find((item) => item.id === lotId);

  if (!lot || skipStatuses.includes(lot.status)) {
    return;
  }

  lot.status = lot.status === "available" ? "occupied" : "available";

  if (lot.status === "occupied") {
    ParkingSimulation.setOccupiedUntil(
      lot.id,
      ParkingSimulation.getCsvIndex() + ParkingSimulation.getMinOccupiedTicks(),
    );
  } else {
    ParkingSimulation.setOccupiedUntil(lot.id, null);
  }

  selectedSpot = null;
  saveLots(floors);
  renderFloors();
}

function createLotEl(lot, floorId, rowPosition = "top") {
  const div = document.createElement("div");

  switch (lot.status) {
    case "entrance":
      div.className = "entrance-door";
      div.textContent = "ENTRANCE";
      return div;

    case "hatch":
      div.className = "lot hatch";
      return div;

    case "lift-box":
      div.className = "lot lift-box";
      div.textContent = "LIFT";
      return div;

    case "stairs-box":
      div.className = "lot stairs-box";
      div.textContent = "STAIRS";
      return div;

    case "disabled":
      div.className = "lot disabled";
      div.innerHTML = "♿";
      return div;

    default: {
      const isSelected =
        selectedSpot &&
        selectedSpot.floorId === floorId &&
        selectedSpot.spotId === lot.id &&
        lot.status === "available";

      div.className = `lot ${lot.status}${isSelected ? " lot-selected" : ""}`;
      div.dataset.rowPosition = rowPosition;
      div.textContent = lot.id;

      if (lot.status === "available") {
        div.title = "Click to view this spot's estimated available time";

        div.addEventListener("click", function (event) {
          event.stopPropagation();

          selectedSpot = {
            floorId: floorId,
            spotId: lot.id,
          };

          renderFloors();
        });
      } else {
        div.title = "This spot is currently occupied";

        div.addEventListener("click", function (event) {
          event.stopPropagation();
          selectedSpot = null;
          renderFloors();
        });
      }

      if (isSelected) {
        div.appendChild(createSpotTimePill(lot.id, rowPosition));
      }

      return div;
    }
  }
}

function createSpotTimePill(spotId, rowPosition = "top") {
  const row = latestRowsBySpot.get(spotId);
  const pill = document.createElement("div");
  if (rowPosition === "bottom") {
    pill.className = "time-pill spot-time-pill time-pill-above";
  } else {
    pill.className = "time-pill spot-time-pill time-pill-below";
  }

  if (!row) {
    pill.innerHTML = `
      <div>Estimated Available Time</div>
      <div class="time-value">🕘 <strong>${estimateAvailableTimeMinutes(spotId)} min</strong></div>
      <small>No CSV data found for ${spotId}</small>
    `;

    return pill;
  }

  const estimateLabel =
    row.estimated_time_label || `${estimateAvailableTimeMinutes(spotId)} min`;

  const probabilityPercent = Math.round(
    clampProbability(row.prob_occupied_per_min) * 100,
  );

  pill.innerHTML = `
    <div>Estimated Available Time</div>
    <div class="time-value">🕘 <strong>${estimateLabel}</strong></div>

    <div class="spot-time-details">
      <div><strong>Spot:</strong> ${spotId}</div>
      <div><strong>Distance:</strong> ${row.spot_distance_entrance} m</div>
      <div><strong>Cars entered:</strong> ${row.cars_entered_last_15}</div>
      <div><strong>Peak hour:</strong> ${formatYesNo(row.is_peak_hour)}</div>
      <div><strong>Weekend:</strong> ${formatYesNo(row.is_weekend)}</div>
      <div><strong>Occupy chance:</strong> ${probabilityPercent}% / min</div>
    </div>
  `;

  return pill;
}

function makeSlopeEl(className) {
  const el = document.createElement("div");
  el.className = className;
  el.innerHTML = `
    <svg class="slope-svg" width="54" height="46" viewBox="0 0 54 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="4,22 27,4 50,22" stroke="#111" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
      <polyline points="4,40 27,22 50,40" stroke="#111" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
    </svg>
    <div class="slope-label">SLOPE</div>
  `;
  return el;
}

function makeGateEl(className) {
  const gate = document.createElement("div");
  gate.className = className;
  gate.innerHTML =
    '<div class="gate-out">OUT</div><div class="gate-in">IN</div>';
  return gate;
}

function createMap(floor) {
  const map = document.createElement("div");
  map.className = "map-area";

  const topRow = document.createElement("div");
  topRow.className = "top-lots";

  const bottomRow = document.createElement("div");
  bottomRow.className = "bottom-lots";

  if (floor.id === "gf") {
    map.classList.add("gf-map");

    map.appendChild(makeSlopeEl("slope-top-left"));
    map.appendChild(makeSlopeEl("slope-top-right"));

    topRow.style.left = "80px";
    topRow.style.right = "80px";

    floor.topLots.forEach((lot) =>
      topRow.appendChild(createLotEl(lot, floor.id, "top")),
    );

    const gate = makeGateEl("gate-labels");
    map.appendChild(gate);

    floor.bottomLots.forEach((lot) =>
      bottomRow.appendChild(createLotEl(lot, floor.id, "bottom")),
    );

    map.appendChild(topRow);
    map.appendChild(bottomRow);

    return map;
  }

  if (floor.id === "l1" || floor.id === "l2") {
    map.classList.add("gated-map");

    floor.topLots.forEach((lot) =>
      topRow.appendChild(createLotEl(lot, floor.id, "top")),
    );
    floor.bottomLots.forEach((lot) =>
      bottomRow.appendChild(createLotEl(lot, floor.id, "bottom")),
    );

    map.appendChild(topRow);
    map.appendChild(bottomRow);
    map.appendChild(makeGateEl("gate-labels-mid"));
    map.appendChild(makeSlopeEl("slope-left slope-left-gated"));
    map.appendChild(makeSlopeEl("slope-right"));

    return map;
  }

  floor.topLots.forEach((lot) =>
    topRow.appendChild(createLotEl(lot, floor.id, "top")),
  );
  floor.bottomLots.forEach((lot) =>
    bottomRow.appendChild(createLotEl(lot, floor.id, "bottom")),
  );

  map.appendChild(topRow);
  map.appendChild(bottomRow);
  map.appendChild(makeSlopeEl("slope-left"));
  map.appendChild(makeSlopeEl("slope-right"));

  return map;
}

function renderFloors() {
  const list = document.getElementById("floorList");
  list.innerHTML = "";

  floors.forEach((floor) => {
    const row = document.createElement("div");
    row.className = `floor-row ${floor.open ? "open" : ""}`;

    const summary = document.createElement("div");
    summary.className = "floor-summary";
    summary.addEventListener("click", () => toggleFloor(floor.id));

    summary.innerHTML = `
      <div class="floor-name-wrap">
        <span>${floor.name}</span>
        <span class="arrow">⌄</span>
      </div>

      <div class="count-label">
        <span>Availability:</span>
        <span class="available-count">${countAvailableLots(floor)}</span>
      </div>
    `;

    const detail = document.createElement("div");
    detail.className = "floor-detail";

    const map = createMap(floor);

    const side = document.createElement("div");
    side.innerHTML = `
      <div class="legend">
        <div><span style="background:var(--occupied)"></span>Occupied</div>
        <div><span style="background:var(--available)"></span>Available</div>
      </div>

      <div class="status-box">
        <strong>Live CSV Status</strong><br />
        Timestamp: ${latestLiveInfo.timestamp}<br />
        Cars entered last 15 min: ${latestLiveInfo.carsEntered}<br />
        Peak hour: ${formatYesNo(latestLiveInfo.isPeakHour)}<br />
        Weekend: ${formatYesNo(latestLiveInfo.isWeekend)}<br />
        CSV rows loaded: ${latestLiveInfo.rowsLoaded}<br />
        Matched spots this tick: ${latestLiveInfo.matchedSpots}<br />
        Missing CSV spots this tick: ${latestLiveInfo.missingSpots}<br /><br />
        <small>1 tick = ${ParkingSimulation.getSimulatedMinutesPerTick()} simulated minutes.</small><br />
        <small>Newly occupied spots stay red for ${ParkingSimulation.getMinOccupiedMinutes()} simulated minutes.</small>
      </div>
    `;

    detail.appendChild(map);
    detail.appendChild(side);

    row.appendChild(summary);
    row.appendChild(detail);

    list.appendChild(row);
  });
}

function formatYesNo(value) {
  if (value === "-" || value === undefined || value === null) {
    return "-";
  }

  return Number(value) === 1 ? "Yes" : "No";
}

window.addEventListener("parkingSimulationReset", () => {
  selectedSpot = null;
});

function mountMapView(container) {
  container.className = "app-view parking-page";
  container.innerHTML = `
    <div class="parking-header">
      <div class="logo-text">Queensbay<span class="mall">Mall</span></div>
      <div class="tagline">It's All Happening Here!</div>
    </div>
    <div class="parking-title-row">
      <div class="parking-title">Parking Availability</div>
      <button type="button" id="simulationResetBtn" class="simulation-reset-btn">
        Reset simulation
      </button>
    </div>
    <div id="floorList" class="floor-list"></div>
  `;

  floors = ParkingSimulation.getFloors();
  selectedSpot = null;
  renderFloors();
  bindSimulationResetButton();
}

