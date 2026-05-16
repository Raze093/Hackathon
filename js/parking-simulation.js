// parking-simulation.js — CSV live simulation shared by map and dashboard

const ParkingSimulation = (function () {
  const CSV_DATA_PATH = "data/queensbay_parking_1week.csv";
  const SIMULATED_MINUTES_PER_TICK = 5;
  const REAL_TICK_MS = 6000;
  const MIN_OCCUPIED_MINUTES = 120;
  const MIN_OCCUPIED_TICKS = Math.ceil(
    MIN_OCCUPIED_MINUTES / SIMULATED_MINUTES_PER_TICK,
  );
  const BOOTSTRAP_MIN_AVAILABLE = 3;
  const BOOTSTRAP_TICK_COUNT = 3;

  let floors = loadLots();
  let sessionTicksApplied = 0;
  let csvTimeline = [];
  let csvIndex = Number(localStorage.getItem("parkingCsvIndex") || 0);
  let liveTimer = null;
  let occupiedUntilTick = JSON.parse(
    localStorage.getItem("parkingOccupiedUntil") || "{}",
  );
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
  let entranceQueues = { l1: 0, l2: 0 };
  const listeners = [];

  function subscribe(listener) {
    listeners.push(listener);
    listener(getSnapshot());

    return function unsubscribe() {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    };
  }

  function notify() {
    const snapshot = getSnapshot();
    listeners.forEach((listener) => listener(snapshot));
  }

  function getSnapshot() {
    return {
      floors,
      latestLiveInfo: { ...latestLiveInfo },
      entranceQueues: { ...entranceQueues },
      latestRowsBySpot,
      csvIndex,
    };
  }

  function getFloors() {
    return floors;
  }

  function getLatestRowsBySpot() {
    return latestRowsBySpot;
  }

  function persistState() {
    saveLots(floors);
    localStorage.setItem("parkingCsvIndex", String(csvIndex));
    localStorage.setItem(
      "parkingOccupiedUntil",
      JSON.stringify(occupiedUntilTick),
    );
    localStorage.setItem(
      "parkingLiveMeta",
      JSON.stringify({
        timestamp: latestLiveInfo.timestamp,
        entranceQueues,
        csvIndex,
      }),
    );
  }

  function applyCsvTick() {
    if (csvTimeline.length === 0) {
      return;
    }

    csvIndex = csvIndex % csvTimeline.length;
    const tick = csvTimeline[csvIndex];
    const rows = tick.rows;
    latestRowsBySpot = new Map(rows.map((row) => [row.spot_id, row]));

    const firstRow = rows[0] || {};
    latestLiveInfo.timestamp = tick.timestamp;
    latestLiveInfo.carsEntered = firstRow.cars_entered_last_15 ?? "-";
    latestLiveInfo.isPeakHour = firstRow.is_peak_hour ?? "-";
    latestLiveInfo.isWeekend = firstRow.is_weekend ?? "-";
    latestLiveInfo.matchedSpots = 0;
    latestLiveInfo.missingSpots = 0;

    entranceQueues = {
      l1: entranceQueueFromRows(rows, "L1"),
      l2: entranceQueueFromRows(rows, "L2"),
    };

    floors.forEach((floor) => {
      getNormalLots(floor).forEach((lot) => {
        const unlockTick = occupiedUntilTick[lot.id];

        if (
          lot.status === "occupied" &&
          unlockTick !== undefined &&
          csvIndex >= unlockTick
        ) {
          lot.status = "available";
          delete occupiedUntilTick[lot.id];
        }
      });
    });

    rows.forEach((row) => {
      const floor = findFloorByCsvLevel(floors, row.level);

      if (!floor) {
        return;
      }

      const lot = allLots(floor).find((item) => item.id === row.spot_id);

      if (!lot || (lot.status !== "available" && lot.status !== "occupied")) {
        return;
      }

      latestLiveInfo.matchedSpots += 1;

      const isLocked =
        occupiedUntilTick[lot.id] !== undefined &&
        csvIndex < occupiedUntilTick[lot.id];

      if (isLocked) {
        lot.status = "occupied";
        return;
      }

      if (lot.status === "available") {
        const probabilityPerMinute = clampProbability(
          row.prob_occupied_per_min,
        );
        const intervalProbability =
          1 - Math.pow(1 - probabilityPerMinute, SIMULATED_MINUTES_PER_TICK);

        if (Math.random() < intervalProbability) {
          lot.status = "occupied";
          occupiedUntilTick[lot.id] = csvIndex + MIN_OCCUPIED_TICKS;
        }
      }
    });

    adjustFloorsToCsvFreeSpotTargets(rows);

    if (sessionTicksApplied < BOOTSTRAP_TICK_COUNT) {
      enforceBootstrapAvailability();
    }

    sessionTicksApplied += 1;

    floors.forEach((floor) => {
      getNormalLots(floor).forEach((lot) => {
        if (!latestRowsBySpot.has(lot.id)) {
          latestLiveInfo.missingSpots += 1;
        }
      });
    });

    persistState();
    notify();
  }

  function enforceBootstrapAvailability() {
    floors.forEach((floor) => {
      const normalLots = getNormalLots(floor);
      const target = Math.min(BOOTSTRAP_MIN_AVAILABLE, normalLots.length);
      let available = normalLots.filter((lot) => lot.status === "available")
        .length;

      if (available >= target) {
        return;
      }

      const candidates = normalLots
        .filter((lot) => lot.status === "occupied")
        .map((lot) => ({
          lot,
          probability: clampProbability(
            latestRowsBySpot.get(lot.id)?.prob_occupied_per_min,
          ),
        }))
        .sort((a, b) => a.probability - b.probability);

      while (available < target && candidates.length > 0) {
        const candidate = candidates.shift();
        candidate.lot.status = "available";
        delete occupiedUntilTick[candidate.lot.id];
        available += 1;
      }
    });
  }

  function adjustFloorsToCsvFreeSpotTargets(rows) {
    const rowsByLevel = new Map();

    rows.forEach((row) => {
      if (!rowsByLevel.has(row.level)) {
        rowsByLevel.set(row.level, []);
      }

      rowsByLevel.get(row.level).push(row);
    });

    rowsByLevel.forEach((levelRows, level) => {
      const floor = findFloorByCsvLevel(floors, level);

      if (!floor) {
        return;
      }

      const targetFree = Number(levelRows[0].free_spots_on_floor);

      if (!Number.isFinite(targetFree)) {
        return;
      }

      const csvSpotIds = new Set(levelRows.map((row) => row.spot_id));
      const floorLotsInCsv = getNormalLots(floor).filter((lot) =>
        csvSpotIds.has(lot.id),
      );
      let currentFree = floorLotsInCsv.filter(
        (lot) => lot.status === "available",
      ).length;

      if (currentFree > targetFree) {
        const candidates = floorLotsInCsv
          .filter((lot) => lot.status === "available")
          .map((lot) => ({
            lot,
            probability: clampProbability(
              latestRowsBySpot.get(lot.id)?.prob_occupied_per_min,
            ),
          }))
          .sort((a, b) => b.probability - a.probability);

        while (currentFree > targetFree && candidates.length > 0) {
          const candidate = candidates.shift();
          candidate.lot.status = "occupied";
          occupiedUntilTick[candidate.lot.id] = csvIndex + MIN_OCCUPIED_TICKS;
          currentFree -= 1;
        }
      }

      if (currentFree < targetFree) {
        const candidates = floorLotsInCsv
          .filter((lot) => {
            const locked =
              occupiedUntilTick[lot.id] !== undefined &&
              csvIndex < occupiedUntilTick[lot.id];
            return lot.status === "occupied" && !locked;
          })
          .map((lot) => ({
            lot,
            probability: clampProbability(
              latestRowsBySpot.get(lot.id)?.prob_occupied_per_min,
            ),
          }))
          .sort((a, b) => a.probability - b.probability);

        while (currentFree < targetFree && candidates.length > 0) {
          const candidate = candidates.shift();
          candidate.lot.status = "available";
          delete occupiedUntilTick[candidate.lot.id];
          currentFree += 1;
        }
      }
    });
  }

  function clampProbability(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return Math.min(1, Math.max(0, number));
  }

  function parseCsv(csvText) {
    const lines = csvText.trim().split(/\r?\n/).filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const headers = splitCsvLine(lines[0]).map((header) => header.trim());

    return lines.slice(1).map((line) => {
      const values = splitCsvLine(line);
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });

      row.free_spots_on_floor = Number(row.free_spots_on_floor);
      row.cars_entered_last_15 = Number(row.cars_entered_last_15);
      row.is_peak_hour = Number(row.is_peak_hour);
      row.is_weekend = Number(row.is_weekend);
      row.spot_distance_entrance = Number(row.spot_distance_entrance);
      row.prob_occupied_per_min = Number(row.prob_occupied_per_min);
      row.estimated_time_avail_min = Number(row.estimated_time_avail_min);

      return row;
    });
  }

  function splitCsvLine(line) {
    const result = [];
    let current = "";
    let insideQuotes = false;

    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"' && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === "," && !insideQuotes) {
        result.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    result.push(current);
    return result;
  }

  function groupRowsByTimestamp(rows) {
    const grouped = new Map();

    rows.forEach((row) => {
      if (!grouped.has(row.timestamp)) {
        grouped.set(row.timestamp, []);
      }

      grouped.get(row.timestamp).push(row);
    });

    return Array.from(grouped.entries()).map(([timestamp, timestampRows]) => ({
      timestamp,
      rows: timestampRows,
    }));
  }

  function nextCsvTick() {
    if (csvTimeline.length === 0) {
      return;
    }

    csvIndex = (csvIndex + 1) % csvTimeline.length;
    applyCsvTick();
  }

  async function start() {
    if (liveTimer) {
      return;
    }

    sessionTicksApplied = 0;

    try {
      const response = await fetch(CSV_DATA_PATH, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Could not load CSV: ${response.status}`);
      }

      const csvText = await response.text();
      const rows = parseCsv(csvText);
      csvTimeline = groupRowsByTimestamp(rows);
      latestLiveInfo.rowsLoaded = rows.length;

      if (csvTimeline.length === 0) {
        throw new Error("CSV has no usable timestamp rows.");
      }

      if (csvIndex >= csvTimeline.length) {
        csvIndex = 0;
      }

      applyCsvTick();
      liveTimer = setInterval(nextCsvTick, REAL_TICK_MS);
    } catch (error) {
      latestLiveInfo.timestamp = "CSV load failed";
      console.error(error);
      notify();
      alert(
        "CSV data could not be loaded. Run the website using a local server, for example: python -m http.server 8000",
      );
    }
  }

  function reloadFloors() {
    floors = loadLots();
    notify();
  }

  function setOccupiedUntil(lotId, tick) {
    if (tick === null) {
      delete occupiedUntilTick[lotId];
    } else {
      occupiedUntilTick[lotId] = tick;
    }
  }

  function getCsvIndex() {
    return csvIndex;
  }

  function getMinOccupiedTicks() {
    return MIN_OCCUPIED_TICKS;
  }

  function getSimulatedMinutesPerTick() {
    return SIMULATED_MINUTES_PER_TICK;
  }

  function getMinOccupiedMinutes() {
    return MIN_OCCUPIED_MINUTES;
  }

  return {
    subscribe,
    start,
    getFloors,
    getLatestRowsBySpot,
    reloadFloors,
    setOccupiedUntil,
    getCsvIndex,
    getMinOccupiedTicks,
    getSimulatedMinutesPerTick,
    getMinOccupiedMinutes,
  };
})();
