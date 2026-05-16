requireLogin();

let floors = loadLots();
      function loadLots() {
        const saved = localStorage.getItem('parkingFloors');
        return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(defaultFloors));
      }
      function saveLots() { localStorage.setItem('parkingFloors', JSON.stringify(floors)); }

      function allLots(floor) { return [...(floor.topLots||[]),...(floor.bottomLots||[])]; }
      function countAvailableLots(floor) { return allLots(floor).filter(l=>l.status==='available').length; }
      function countOccupiedLots(floor)  { return allLots(floor).filter(l=>l.status==='occupied').length; }
      function countTotalAvailable() { return floors.reduce((s,f)=>s+countAvailableLots(f),0); }
      function countTotalOccupied()  { return floors.reduce((s,f)=>s+countOccupiedLots(f),0); }

      // Estimated time uses fixed defaults (controls removed)
      function estimateAvailableTimeMinutes() {
        const avgDuration  = 120;
        const enteringCars = 0;
        const occupied = Math.max(1, countTotalOccupied());
        const base  = avgDuration / occupied;
        const buf   = Math.max(0.55, 1 - countTotalAvailable() * 0.015);
        return Math.max(1, Math.round(base * buf));
      }

      function toggleFloor(floorId) {
        floors = floors.map(f=>({...f, open: f.id===floorId ? !f.open : f.open}));
        saveLots(); renderFloors();
      }
      function toggleLot(floorId, lotId) {
        const floor = floors.find(f=>f.id===floorId);
        const SKIP = ['disabled','entrance','hatch','lift-box','stairs-box'];
        const lot = allLots(floor).find(l=>l.id===lotId);
        if (!lot || SKIP.includes(lot.status)) return;
        lot.status = lot.status==='available' ? 'occupied' : 'available';
        saveLots(); renderFloors();
      }

      // ── Build single lot element ───────────────────────────────────────────
      function createLotEl(lot, floorId) {
        const div = document.createElement('div');
        switch(lot.status) {
          case 'entrance':
            div.className = 'entrance-door';
            div.textContent = 'ENTRANCE';
            return div;
          case 'hatch':
            div.className = 'lot hatch';
            return div;
          case 'lift-box':
            div.className = 'lot lift-box';
            div.textContent = 'LIFT';
            return div;
          case 'stairs-box':
            div.className = 'lot stairs-box';
            div.textContent = 'STAIRS';
            return div;
          case 'disabled':
            div.className = 'lot disabled';
            div.innerHTML = '♿';
            return div;
          default:
            div.className = `lot ${lot.status}`;
            div.textContent = lot.id;
            div.title = 'Click to toggle';
            div.addEventListener('click', ()=>toggleLot(floorId, lot.id));
            return div;
        }
      }

      // ── Helper: build a slope element with open SVG chevrons ─────────────
      function makeSlopeEl(className) {
        const el = document.createElement('div');
        el.className = className;
        el.innerHTML = `
          <svg class="slope-svg" width="54" height="46" viewBox="0 0 54 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="4,22 27,4 50,22" stroke="#111" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
            <polyline points="4,40 27,22 50,40" stroke="#111" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
          </svg>
          <div class="slope-label">SLOPE</div>`;
        return el;
      }

      // ── Helper: build IN/OUT gate element ────────────────────────────────
      function makeGateEl(cls) {
        const gate = document.createElement('div');
        gate.className = cls;
        gate.innerHTML = '<div class="gate-out">OUT</div><div class="gate-in">IN</div>';
        return gate;
      }

      // ── Build map for a floor ─────────────────────────────────────────────
      function createMap(floor) {
        const map = document.createElement('div');
        map.className = 'map-area';

        const topRow = document.createElement('div');
        topRow.className = 'top-lots';
        const botRow = document.createElement('div');
        botRow.className = 'bottom-lots';

        // ── GF: top slopes as absolute boxes, full-width rows, IN/OUT label bottom-left, no bottom slopes ──
        if (floor.id === 'gf') {
          map.classList.add('gf-map');

          // Top slope left & right (absolute) with chevrons
          map.appendChild(makeSlopeEl('slope-top-left'));
          map.appendChild(makeSlopeEl('slope-top-right'));

          // Top lots: shrink to avoid overlapping top slopes
          topRow.style.left = '80px';
          topRow.style.right = '80px';

          floor.topLots.forEach(lot => topRow.appendChild(createLotEl(lot, floor.id)));

          // Bottom row: full width, CSS .gf-map .bottom-lots handles left padding for gate
          // IN/OUT gate on bottom-left
          const gate = makeGateEl('gate-labels');
          map.appendChild(gate);

          floor.bottomLots.forEach(lot => botRow.appendChild(createLotEl(lot, floor.id)));

          map.appendChild(topRow);
          map.appendChild(botRow);

          const pill = document.createElement('div');
          pill.className = 'time-pill';
          pill.innerHTML = `<div>Estimated Available Time</div><div class="time-value">🕘 <strong>${estimateAvailableTimeMinutes()} min</strong></div>`;
          map.appendChild(pill);
          return map;
        }

        // ── L1 / L2: slopes on bottom-left and bottom-right, IN/OUT gate mid-left ──
        if (floor.id === 'l1' || floor.id === 'l2') {
          map.classList.add('gated-map');
          floor.topLots.forEach(lot => topRow.appendChild(createLotEl(lot, floor.id)));
          floor.bottomLots.forEach(lot => botRow.appendChild(createLotEl(lot, floor.id)));

          map.appendChild(topRow);
          map.appendChild(botRow);

          // Gate goes first (behind slope visually but at left:0)
          map.appendChild(makeGateEl('gate-labels-mid'));

          // Left slope shifted right by gate width so gate is fully visible
          map.appendChild(makeSlopeEl('slope-left slope-left-gated'));
          map.appendChild(makeSlopeEl('slope-right'));

          const pill = document.createElement('div');
          pill.className = 'time-pill';
          pill.innerHTML = `<div>Estimated Available Time</div><div class="time-value">🕘 <strong>${estimateAvailableTimeMinutes()} min</strong></div>`;
          map.appendChild(pill);
          return map;
        }

        // ── ALL OTHER FLOORS: slopes on bottom-left and bottom-right ──
        floor.topLots.forEach(lot => topRow.appendChild(createLotEl(lot, floor.id)));
        floor.bottomLots.forEach(lot => botRow.appendChild(createLotEl(lot, floor.id)));

        map.appendChild(topRow);
        map.appendChild(botRow);

        map.appendChild(makeSlopeEl('slope-left'));
        map.appendChild(makeSlopeEl('slope-right'));

        const pill = document.createElement('div');
        pill.className = 'time-pill';
        pill.innerHTML = `<div>Estimated Available Time</div><div class="time-value">🕘 <strong>${estimateAvailableTimeMinutes()} min</strong></div>`;
        map.appendChild(pill);

        return map;
      }

      // ── Render ────────────────────────────────────────────────────────────
      function renderFloors() {
        const list = document.getElementById('floorList');
        list.innerHTML = '';
        floors.forEach(floor => {
          const row = document.createElement('div');
          row.className = `floor-row ${floor.open ? 'open' : ''}`;

          const summary = document.createElement('div');
          summary.className = 'floor-summary';
          summary.addEventListener('click', ()=>toggleFloor(floor.id));
          summary.innerHTML = `
            <div class="floor-name-wrap">
              <span>${floor.name}</span>
              <span class="arrow">⌄</span>
            </div>
            <div class="count-label">
              <span>Availability:</span>
              <span class="available-count">${countAvailableLots(floor)}</span>
            </div>`;

          const detail = document.createElement('div');
          detail.className = 'floor-detail';

          const map = createMap(floor);

          const side = document.createElement('div');
          side.innerHTML = `
            <div class="legend">
              <div><span style="background:var(--occupied)"></span>Occupied</div>
              <div><span style="background:var(--available)"></span>Available</div>
            </div>
            <div class="status-box">
            </div>`;

          detail.appendChild(map);
          detail.appendChild(side);
          row.appendChild(summary);
          row.appendChild(detail);
          list.appendChild(row);
        });
      }

document.getElementById('logoutBtn').addEventListener('click', logout);
renderFloors();
