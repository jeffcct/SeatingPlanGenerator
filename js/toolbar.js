"use strict";

/* =========================================================
   TOOLBAR ACTIONS
   ========================================================= */

function duplicateSelected(){
  if (state.selected.size === 0) return;
  const offset = GRID * 2;
  const newIds = [];
  Array.from(state.selected).forEach(id => {
    const t = findTable(id);
    const copy = makeTable(t.type, t.x + offset, t.y + offset, t.seatCount);
    copy.orientation = t.orientation;
    state.tables.push(copy);
    newIds.push(copy.id);
  });
  clearSelection();
  newIds.forEach(id => state.selected.add(id));
  renderAll();
}

function deleteSelected(){
  if (state.selected.size === 0) return;
  state.tables = state.tables.filter(t => !state.selected.has(t.id));
  clearSelection();
  renderAll();
}

function rotateSelected(){
  let any = false;
  state.selected.forEach(id => {
    const t = findTable(id);
    if (t && t.type === "rect"){
      t.orientation = t.orientation === "horizontal" ? "vertical" : "horizontal";
      any = true;
    }
  });
  if (any) renderAll();
}

function changeSeatCount(delta){
  if (state.selected.size !== 1) return;
  const t = findTable(Array.from(state.selected)[0]);
  if (!t || t.type === "desk") return;
  const max = 16;
  const newCount = Math.min(max, Math.max(1, t.seatCount + delta));
  if (newCount === t.seatCount) return;
  t.seatCount = newCount;
  regenSeats(t);
  renderAll();
}

duplicateBtn.addEventListener("click", duplicateSelected);
deleteBtn.addEventListener("click", deleteSelected);
rotateBtn.addEventListener("click", rotateSelected);
seatMinus.addEventListener("click", () => changeSeatCount(-1));
seatPlus.addEventListener("click", () => changeSeatCount(1));

document.getElementById("clearBtn").addEventListener("click", () => {
  if (state.tables.length && !confirm("Clear the whole room? This removes all tables and seats.")) return;
  state.tables = [];
  clearSelection();
  renderAll();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const data = JSON.stringify({ tables: state.tables }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "seating-plan.json"; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importBtn").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.tables)) throw new Error("bad shape");
      state.tables = data.tables.map(t => {
        if (!t.orientation) t.orientation = "horizontal";
        if (!t.seats) regenSeats(t);
        return t;
      });
      clearSelection();
      renderAll();
    } catch (err){
      alert("Could not read that file — is it a seating plan JSON export?");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* =========================================================
   PALETTE — drag new furniture onto the room
   ========================================================= */

const PALETTE_ITEMS = [
  { type: "round", seats: 4, name: "Round table", meta: "4 seats" },
  { type: "round", seats: 6, name: "Round table", meta: "6 seats" },
  { type: "round", seats: 8, name: "Round table", meta: "8 seats" },
  { type: "rect",  seats: 4, name: "Rect. table", meta: "4 seats" },
  { type: "rect",  seats: 6, name: "Rect. table", meta: "6 seats" },
  { type: "rect",  seats: 8, name: "Rect. table", meta: "8 seats" },
  { type: "desk",  seats: 1, name: "Single desk", meta: "1 seat" },
  { type: "spot",  seats: 1, name: "Spot", meta: "No table" }
];

PALETTE_ITEMS.forEach(item => {
  const card = document.createElement("div");
  card.className = "palette-card";
  card.draggable = true;
  card.dataset.type = item.type;
  card.dataset.seats = item.seats;

  const preview = document.createElement("div");
  preview.className = "palette-preview";
  preview.appendChild(buildPreview(item));

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = item.name;
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = item.meta;

  card.appendChild(preview);
  card.appendChild(name);
  card.appendChild(meta);
  paletteEl.appendChild(card);

  card.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: item.type, seatCount: item.seats }));
    e.dataTransfer.effectAllowed = "copy";
  });
});

function buildPreview(item){
  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.style.width = "100%"; wrap.style.height = "100%";

  if (item.type === "spot"){
    const dot = document.createElement("div");
    dot.className = "pp-dot";
    dot.style.cssText = "left:24px;top:17px;width:9px;height:9px;";
    wrap.appendChild(dot);
    return wrap;
  }

  if (item.type === "desk"){
    const shape = document.createElement("div");
    shape.className = "pp-shape";
    shape.style.cssText = "left:18px;top:6px;width:18px;height:14px;";
    wrap.appendChild(shape);
    const dot = document.createElement("div");
    dot.className = "pp-dot";
    dot.style.cssText = "left:24px;top:26px;";
    wrap.appendChild(dot);
    return wrap;
  }

  if (item.type === "round"){
    const shape = document.createElement("div");
    shape.className = "pp-shape round";
    shape.style.cssText = "left:17px;top:10px;width:20px;height:20px;";
    wrap.appendChild(shape);
    const n = item.seats;
    for (let i = 0; i < n; i++){
      const angle = -Math.PI / 2 + i * (2 * Math.PI / n);
      const dot = document.createElement("div");
      dot.className = "pp-dot";
      dot.style.left = (27 + 17 * Math.cos(angle) - 3) + "px";
      dot.style.top = (20 + 17 * Math.sin(angle) - 3) + "px";
      wrap.appendChild(dot);
    }
    return wrap;
  }

  // rect
  const shape = document.createElement("div");
  shape.className = "pp-shape";
  shape.style.cssText = "left:10px;top:15px;width:34px;height:12px;";
  wrap.appendChild(shape);
  const top = Math.ceil(item.seats / 2), bottom = Math.floor(item.seats / 2);
  for (let i = 0; i < top; i++){
    const dot = document.createElement("div");
    dot.className = "pp-dot";
    dot.style.left = (10 + (i + 0.5) * (34 / top) - 3) + "px";
    dot.style.top = "6px";
    wrap.appendChild(dot);
  }
  for (let i = 0; i < bottom; i++){
    const dot = document.createElement("div");
    dot.className = "pp-dot";
    dot.style.left = (10 + (i + 0.5) * (34 / bottom) - 3) + "px";
    dot.style.top = "31px";
    wrap.appendChild(dot);
  }
  return wrap;
}

room.addEventListener("dragover", e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
room.addEventListener("drop", e => {
  e.preventDefault();
  let data;
  try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (err){ return; }
  if (!data || !data.type) return;
  const layerRect = tablesLayer.getBoundingClientRect();
  const x = e.clientX - layerRect.left - 40;
  const y = e.clientY - layerRect.top - 40;
  const table = makeTable(data.type, x, y, data.seatCount);
  state.tables.push(table);
  clearSelection();
  state.selected.add(table.id);
  renderAll();
});

/* =========================================================
   GRID GENERATOR — quickly lay out a grid of any table type
   ========================================================= */

const gridTableType = document.getElementById("gridTableType");
const gridSeatCountField = document.getElementById("gridSeatCountField");
const gridSeatCount = document.getElementById("gridSeatCount");

function updateGridSeatCountVisibility(){
  const needsSeatCount = gridTableType.value === "round" || gridTableType.value === "rect";
  gridSeatCountField.style.display = needsSeatCount ? "" : "none";
}
gridTableType.addEventListener("change", () => {
  if (gridTableType.value === "round") gridSeatCount.value = 6;
  if (gridTableType.value === "rect") gridSeatCount.value = 4;
  updateGridSeatCountVisibility();
});
updateGridSeatCountVisibility();

function generateGrid(){
  const rows = Math.max(1, parseInt(document.getElementById("gridRows").value, 10) || 1);
  const cols = Math.max(1, parseInt(document.getElementById("gridCols").value, 10) || 1);
  const aisleAfterCols = Math.max(0, parseInt(document.getElementById("gridAisle").value, 10) || 0);
  const aisleAfterRows = Math.max(0, parseInt(document.getElementById("gridAisleRows").value, 10) || 0);
  const type = gridTableType.value;
  const seatCount = (type === "round" || type === "rect")
    ? Math.max(1, parseInt(gridSeatCount.value, 10) || defaultSeatCount(type))
    : 1;

  // size each grid cell to whatever footprint this table type/seat count
  // actually needs, so round tables with lots of seats (or wide rect
  // tables) don't overlap their neighbors — computeLayout only reads
  // type/seatCount/orientation, so this doesn't need a real table object
  const sampleLayout = computeLayout({ type, seatCount, orientation: "horizontal" });
  const cellGap = 20;
  const spacingX = sampleLayout.w + cellGap;
  const spacingY = sampleLayout.h + cellGap;
  const aisleGapX = 40, aisleGapY = 40;
  const originX = 40, originY = 80;
  const newIds = [];

  let curY = originY;
  for (let r = 0; r < rows; r++){
    let curX = originX;
    for (let c = 0; c < cols; c++){
      const table = makeTable(type, curX, curY, seatCount);
      state.tables.push(table);
      newIds.push(table.id);
      curX += spacingX;
      if (aisleAfterCols > 0 && (c + 1) % aisleAfterCols === 0 && c + 1 < cols) curX += aisleGapX;
    }
    curY += spacingY;
    if (aisleAfterRows > 0 && (r + 1) % aisleAfterRows === 0 && r + 1 < rows) curY += aisleGapY;
  }
  clearSelection();
  newIds.forEach(id => state.selected.add(id));
  renderAll();
}

document.getElementById("gridGenBtn").addEventListener("click", generateGrid);

document.getElementById("examPresetBtn").addEventListener("click", () => {
  gridTableType.value = "desk";
  updateGridSeatCountVisibility();
  document.getElementById("gridRows").value = 15;
  document.getElementById("gridCols").value = 15;
  document.getElementById("gridAisle").value = 5;
  document.getElementById("gridAisleRows").value = 5;
  generateGrid();
});