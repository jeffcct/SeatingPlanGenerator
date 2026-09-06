"use strict";

/* =========================================================
   SELECTION
   ========================================================= */

function clearSelection(){ state.selected.clear(); }
function selectTable(id){ state.selected.add(id); }
function toggleSelect(id){ state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id); }

/* =========================================================
   DRAGGING A TABLE (or the whole current selection together)
   ========================================================= */

function onTableMouseDown(e, table){
  if (e.button !== 0) return;
  if (e.target.isContentEditable) return;
  e.stopPropagation();

  const shift = e.shiftKey;
  let pendingExclusive = false;

  if (shift){
    toggleSelect(table.id);
  } else if (state.selected.has(table.id)){
    pendingExclusive = true; // resolved on mouseup if it turns out to be a plain click
  } else {
    clearSelection();
    selectTable(table.id);
  }
  renderAll();

  const startX = e.clientX, startY = e.clientY;
  const startPositions = new Map();
  state.selected.forEach(id => {
    const t = findTable(id);
    startPositions.set(id, { x: t.x, y: t.y });
  });
  let moved = false;

  function onMove(ev){
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    if (moved){
      startPositions.forEach((pos, id) => {
        const t = findTable(id);
        t.x = pos.x + dx;
        t.y = pos.y + dy;
      });
      renderAll();
    }
  }
  function onUp(){
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    if (moved){
      state.selected.forEach(id => {
        const t = findTable(id);
        t.x = snap(t.x);
        t.y = snap(t.y);
      });
      renderAll();
    } else if (pendingExclusive){
      clearSelection();
      selectTable(table.id);
      renderAll();
    }
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/* =========================================================
   BOX SELECT on empty room space
   ========================================================= */

room.addEventListener("mousedown", e => {
  if (e.target.closest(".table-el")) return;
  if (e.button !== 0) return;
  if (!e.shiftKey) { clearSelection(); renderAll(); }

  const layerRect = tablesLayer.getBoundingClientRect();
  const startX = e.clientX - layerRect.left, startY = e.clientY - layerRect.top;
  const box = document.createElement("div");
  box.className = "select-box";
  room.appendChild(box);

  function onMove(ev){
    const cx = ev.clientX - layerRect.left, cy = ev.clientY - layerRect.top;
    const x = Math.min(startX, cx), y = Math.min(startY, cy);
    const w = Math.abs(cx - startX), h = Math.abs(cy - startY);
    box.style.left = x + "px"; box.style.top = y + "px";
    box.style.width = w + "px"; box.style.height = h + "px";

    state.tables.forEach(t => {
      const layout = computeLayout(t);
      const intersects = !(t.x > x + w || t.x + layout.w < x || t.y > y + h || t.y + layout.h < y);
      if (intersects) state.selected.add(t.id);
      else if (!ev.shiftKey) state.selected.delete(t.id);
    });
    renderAll();
    room.appendChild(box); // renderAll only touches tablesLayer, box is safe, but keep it on top
  }
  function onUp(){
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    box.remove();
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
});

/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

document.addEventListener("keydown", e => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;

  if (e.key === "Delete" || e.key === "Backspace"){ e.preventDefault(); deleteSelected(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d"){ e.preventDefault(); duplicateSelected(); return; }
  if (e.key === "Escape"){ clearSelection(); renderAll(); return; }

  const arrowMap = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (arrowMap[e.key] && state.selected.size){
    e.preventDefault();
    const step = e.shiftKey ? GRID : 2;
    const [dx, dy] = arrowMap[e.key];
    state.selected.forEach(id => {
      const t = findTable(id);
      t.x += dx * step; t.y += dy * step;
    });
    renderAll();
  }
});