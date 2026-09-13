"use strict";

/* =========================================================
   ATTACHING STUDENTS TO SEATS

   Two ways to place a student:
   - drag their roster card onto a seat
   - click their roster card to "arm" it, then click an empty seat
   Clicking an occupied seat unseats whoever is there.
   ========================================================= */

let armedStudentId = null;

function setArmedStudent(id){
  armedStudentId = (armedStudentId === id) ? null : id;
  renderRoster();
  renderAll();
}
function clearArmedStudent(){
  armedStudentId = null;
}

function assignStudentToSeatId(seatId, studentId){
  const student = findStudentById(studentId);
  const seat = findSeatById(seatId);
  if (!student || !seat) return false;

  // a student can only be in one seat at a time
  const prev = getSeatAssignment(studentId);
  if (prev) prev.seat.student = null;

  // dropping onto an occupied seat bumps whoever was there
  seat.student = student;

  recomputeWarnings();
  renderAll();
  renderRoster();
  return true;
}

function unassignSeatById(seatId){
  const seat = findSeatById(seatId);
  if (!seat || !seat.student) return false;
  seat.student = null;
  recomputeWarnings();
  renderAll();
  renderRoster();
  return true;
}

function wireSeatInteractions(seatEl, seat){
  // stop the seat from also triggering the parent table's drag/select
  seatEl.addEventListener("mousedown", e => e.stopPropagation());

  seatEl.addEventListener("click", e => {
    e.stopPropagation();
    if (seat.student){
      unassignSeatById(seat.id);
    } else if (armedStudentId){
      const id = armedStudentId;
      clearArmedStudent();
      assignStudentToSeatId(seat.id, id);
    }
  });

  seatEl.addEventListener("dragover", e => e.preventDefault());
  seatEl.addEventListener("drop", e => {
    e.preventDefault();
    e.stopPropagation();
    let data;
    try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (err){ return; }
    if (data && data.studentId){
      clearArmedStudent();
      assignStudentToSeatId(seat.id, data.studentId);
    }
  });
}

/* =========================================================
   SHARED SEAT GEOMETRY
   Used by both the requirements checker below and the seating-plan
   generator (js/generate.js), so "front/back" and "next to" mean
   exactly the same thing in both places.
   ========================================================= */

const ROW_CLUSTER_TOLERANCE = 40; // px — seat centers within this y-distance count as the same row

// Clusters every seat in the room into rows by y position (same idea as
// groupSeatsIntoColumns in sheets-export.js, but by row instead of column),
// then returns each seat's row index (0 = frontmost row). This is what lets
// "must not sit next to" mean "not in the same row or a neighbouring row",
// regardless of how far apart the seats actually are within those rows.
function computeSeatRows(seatsInfo){
  const sorted = seatsInfo.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  sorted.forEach(info => {
    let row = rows.find(r => Math.abs(r.y - info.y) <= ROW_CLUSTER_TOLERANCE);
    if (!row){
      row = { y: info.y, seats: [] };
      rows.push(row);
    }
    row.seats.push(info);
    // running average keeps a wide row's reference y centered, so later
    // members near its far edge don't drift out of tolerance
    row.y = (row.y * (row.seats.length - 1) + info.y) / row.seats.length;
  });

  rows.sort((a, b) => a.y - b.y);
  const rowIndexBySeatId = new Map();
  rows.forEach((row, idx) => row.seats.forEach(info => rowIndexBySeatId.set(info.seat.id, idx)));
  return rowIndexBySeatId;
}

// Aisle dividers (state.aisles) are vertical lines spanning the whole room,
// each marking a section boundary. A seat's section index counts how many
// aisles sit to its left, so two seats on opposite sides of even one aisle
// always land in different, non-adjacent sections — no matter how close
// together they are — while seats with no aisle between them share a
// section regardless of how far apart they are.
function computeSeatSections(seatsInfo){
  const aisleXs = state.aisles.map(a => a.x).sort((a, b) => a - b);
  const sectionIndexBySeatId = new Map();
  seatsInfo.forEach(info => {
    let idx = 0;
    aisleXs.forEach(x => { if (info.x >= x) idx++; });
    sectionIndexBySeatId.set(info.seat.id, idx);
  });
  return sectionIndexBySeatId;
}

// True if two seats are in the same row (not just neighbouring rows).
function inSameRow(rowIndexBySeatId, seatIdA, seatIdB){
  const a = rowIndexBySeatId.get(seatIdA);
  const b = rowIndexBySeatId.get(seatIdB);
  return a != null && b != null && a === b;
}

// True if two seats are in the same row, or in rows next to each other.
function inSameOrNeighbouringRow(rowIndexBySeatId, seatIdA, seatIdB){
  const a = rowIndexBySeatId.get(seatIdA);
  const b = rowIndexBySeatId.get(seatIdB);
  return a != null && b != null && Math.abs(a - b) <= 1;
}

// True if no aisle divider separates the two seats into different sections.
function inSameSection(sectionIndexBySeatId, seatIdA, seatIdB){
  const a = sectionIndexBySeatId.get(seatIdA);
  const b = sectionIndexBySeatId.get(seatIdB);
  return a != null && b != null && a === b;
}

function seatCenter(table, layout, index){
  return {
    x: table.x + layout.seats[index].x + layout.seatW / 2,
    y: table.y + layout.seats[index].y + layout.seatH / 2
  };
}

// Returns every seat's center point, front/back thresholds (based on the
// vertical spread of all placed tables — top third = front, bottom third =
// back), each seat's row index, and each seat's section index (relative to
// any aisle dividers).
function computeSeatGeometry(){
  const seatsInfo = [];      // [{ seat, table, index, x, y }]
  const centers = new Map(); // seatId -> {x,y}
  let minY = Infinity, maxY = -Infinity;

  state.tables.forEach(t => {
    const layout = computeLayout(t);
    t.seats.forEach((seat, i) => {
      const c = seatCenter(t, layout, i);
      centers.set(seat.id, c);
      seatsInfo.push({ seat, table: t, index: i, x: c.x, y: c.y });
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y);
    });
  });

  const hasRange = isFinite(minY) && maxY > minY;
  const backThreshold = hasRange ? minY + (maxY - minY) * 0.66 : null;
  const frontThreshold = hasRange ? minY + (maxY - minY) * 0.33 : null;
  const rowIndexBySeatId = computeSeatRows(seatsInfo);
  const sectionIndexBySeatId = computeSeatSections(seatsInfo);

  return { seatsInfo, centers, hasRange, backThreshold, frontThreshold, minY, maxY, rowIndexBySeatId, sectionIndexBySeatId };
}

/* =========================================================
   REQUIREMENTS CHECKING
   A heuristic check, run after every assignment or requirement edit:
   - "front"/"back" is judged by each seat's vertical position relative
     to the vertical spread of all placed tables (top third = front,
     bottom third = back).
   - "must sit next to" is satisfied only when the pair is in the same
     row AND the same section (no aisle divider between them) — sharing a
     row is not enough if an aisle runs between the two seats.
   - "must not sit next to" is violated when the pair is in the same row,
     or in rows next to each other, AND in the same section — an aisle
     between them means they're in different sections and the requirement
     is considered satisfied even if the rows line up or are adjacent.
   ========================================================= */

function recomputeWarnings(){
  const warnings = [];           // { studentId, seatId, message }
  const seatWarnMap = new Map(); // seatId -> [message, ...]

  const { centers, hasRange, backThreshold, frontThreshold, rowIndexBySeatId, sectionIndexBySeatId } = computeSeatGeometry();

  function addWarning(studentId, seatId, message){
    warnings.push({ studentId, seatId, message });
    if (seatId){
      if (!seatWarnMap.has(seatId)) seatWarnMap.set(seatId, []);
      seatWarnMap.get(seatId).push(message);
    }
  }

  state.students.forEach(student => {
    const req = student.requirements;
    const placement = getSeatAssignment(student.id);

    if (req.position){
      if (!placement){
        addWarning(student.id, null, student.name + " needs a " + req.position + " seat but hasn't been placed yet.");
      } else if (hasRange){
        const c = centers.get(placement.seat.id);
        const inBack = c.y >= backThreshold;
        const inFront = c.y <= frontThreshold;
        if (req.position === "back" && !inBack){
          addWarning(student.id, placement.seat.id, student.name + " must sit at the back of the room.");
        }
        if (req.position === "front" && !inFront){
          addWarning(student.id, placement.seat.id, student.name + " must sit at the front of the room.");
        }
      }
    }

    req.mustSitNextTo.forEach(otherId => {
      const other = findStudentById(otherId);
      if (!other) return;
      const otherPlacement = getSeatAssignment(otherId);
      if (!placement || !otherPlacement){
        addWarning(student.id, placement ? placement.seat.id : null,
          student.name + " must sit next to " + other.name + ", but one of them hasn't been placed.");
        return;
      }
      const sameRow = inSameRow(rowIndexBySeatId, placement.seat.id, otherPlacement.seat.id);
      const sameSection = inSameSection(sectionIndexBySeatId, placement.seat.id, otherPlacement.seat.id);
      if (!sameRow || !sameSection){
        addWarning(student.id, placement.seat.id, student.name + " must sit next to " + other.name + ".");
      }
    });

    req.mustNotSitNextTo.forEach(otherId => {
      const other = findStudentById(otherId);
      if (!other || !placement) return;
      const otherPlacement = getSeatAssignment(otherId);
      if (!otherPlacement) return;
      const rowConflict = inSameOrNeighbouringRow(rowIndexBySeatId, placement.seat.id, otherPlacement.seat.id);
      const sameSection = inSameSection(sectionIndexBySeatId, placement.seat.id, otherPlacement.seat.id);
      if (rowConflict && sameSection){
        addWarning(student.id, placement.seat.id, student.name + " must not sit next to " + other.name + " (same or neighbouring row, same section).");
      }
    });
  });

  state.warnings = warnings;
  state.seatWarnMap = seatWarnMap;
}