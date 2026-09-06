"use strict";

/* =========================================================
   DATA MODEL
   Each table owns an array of seats. Each seat carries a
   `student` field, currently always null. The next phase can
   write to it — e.g. seat.student = { id, name, requirements }
   — and everything here (rendering, export, duplication)
   already knows how to carry that field around.
   ========================================================= */

const GRID = 20; // px snap size, matches the visible dot grid

const state = {
  tables: [],
  selected: new Set(),   // Set<tableId>
  counters: { round: 0, rect: 0, desk: 0, spot: 0 }
};

function uid(prefix){
  return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function snap(v){ return Math.round(v / GRID) * GRID; }

function nextLabel(type){
  state.counters[type] = (state.counters[type] || 0) + 1;
  const prefix = type === "desk" ? "Desk " : type === "spot" ? "Spot " : "Table ";
  return prefix + state.counters[type];
}

function defaultSeatCount(type){
  if (type === "round") return 6;
  if (type === "rect") return 4;
  return 1; // desk / spot
}

function regenSeats(table){
  const old = table.seats || [];
  const seats = [];
  for (let i = 0; i < table.seatCount; i++){
    // Preserve an existing seat (and any assigned student) at the same
    // index when a table is resized, rather than discarding it.
    seats.push(old[i] || { id: uid("seat"), tableId: table.id, index: i, student: null });
  }
  table.seats = seats;
}

function makeTable(type, x, y, seatCount, label){
  const table = {
    id: uid("table"),
    type,
    x: snap(x),
    y: snap(y),
    orientation: "horizontal", // only meaningful for 'rect'
    seatCount: seatCount || defaultSeatCount(type),
    label: label || nextLabel(type),
    seats: []
  };
  regenSeats(table);
  return table;
}

function findTable(id){ return state.tables.find(t => t.id === id); }
function findSeatById(seatId){
  for (const t of state.tables){
    const s = t.seats.find(s => s.id === seatId);
    if (s) return s;
  }
  return null;
}

/* ---- Public API for the future "students" phase ---- */
function assignStudentToSeat(seatId, student){
  const seat = findSeatById(seatId);
  if (!seat) return false;
  seat.student = student; // { id, name, requirements: [...] }
  renderAll();
  return true;
}
function unassignSeat(seatId){
  const seat = findSeatById(seatId);
  if (!seat) return false;
  seat.student = null;
  renderAll();
  return true;
}
window.SeatingPlanAPI = {
  assignStudentToSeat,
  unassignSeat,
  findSeatById,
  findTable,
  getState: () => state
};