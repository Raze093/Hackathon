// parking-utils.js — shared parking floor helpers

function loadLots() {
  const saved = localStorage.getItem("parkingFloors");
  return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(defaultFloors));
}

function saveLots(floors) {
  localStorage.setItem("parkingFloors", JSON.stringify(floors));
}

function allLots(floor) {
  return [...(floor.topLots || []), ...(floor.bottomLots || [])];
}

function getNormalLots(floor) {
  return allLots(floor).filter((lot) => {
    return lot.status === "available" || lot.status === "occupied";
  });
}

function countAvailableLots(floor) {
  return allLots(floor).filter((lot) => lot.status === "available").length;
}

function countOccupiedLots(floor) {
  return allLots(floor).filter((lot) => lot.status === "occupied").length;
}

function countTotalAvailable(floors) {
  return floors.reduce((sum, floor) => sum + countAvailableLots(floor), 0);
}

function countTotalOccupied(floors) {
  return floors.reduce((sum, floor) => sum + countOccupiedLots(floor), 0);
}

function findFloorByCsvLevel(floors, level) {
  const levelMap = {
    LG: "lg",
    GF: "gf",
    L1: "l1",
    L2: "l2",
    L3: "l3",
  };

  const floorId = levelMap[level];
  return floors.find((floor) => floor.id === floorId);
}

function clampProbability(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(1, Math.max(0, number));
}

function entranceQueueFromRows(rows, level) {
  const levelRows = rows.filter((row) => row.level === level);
  if (levelRows.length === 0) {
    return 0;
  }

  const cars = Number(levelRows[0].cars_entered_last_15);
  if (!Number.isFinite(cars)) {
    return 0;
  }

  return Math.min(24, Math.max(0, Math.round(cars * 0.4)));
}
