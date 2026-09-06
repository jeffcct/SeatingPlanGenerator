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

const ADJACENCY_DISTANCE = 110; // px between seat centers to count as "next to"

function seatCenter(table, layout, index){
  return {
    x: table.x + layout.seats[index].x + layout.seatW / 2,
    y: table.y + layout.seats[index].y + layout.seatH / 2
  };
}

function distance(a, b){
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Returns every seat's center point plus front/back thresholds, based on
// the vertical spread of all placed tables (top third = front zone,
// bottom third = back zone).
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

  return { seatsInfo, centers, hasRange, backThreshold, frontThreshold, minY, maxY };
}

/* =========================================================
   REQUIREMENTS CHECKING
   A heuristic check, run after every assignment or requirement edit:
   - "front"/"back" is judged by each seat's vertical position relative
     to the vertical spread of all placed tables (top third = front,
     bottom third = back).
   - "next to" is judged by raw pixel distance between seat centers,
     which works the same way across round tables, rectangular tables,
     and single desks without needing per-shape adjacency rules.
   ========================================================= */

function recomputeWarnings(){
  const warnings = [];           // { studentId, seatId, message }
  const seatWarnMap = new Map(); // seatId -> [message, ...]

  const { centers, hasRange, backThreshold, frontThreshold } = computeSeatGeometry();

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
      const d = distance(centers.get(placement.seat.id), centers.get(otherPlacement.seat.id));
      if (d > ADJACENCY_DISTANCE){
        addWarning(student.id, placement.seat.id, student.name + " must sit next to " + other.name + ".");
      }
    });

    req.mustNotSitNextTo.forEach(otherId => {
      const other = findStudentById(otherId);
      if (!other || !placement) return;
      const otherPlacement = getSeatAssignment(otherId);
      if (!otherPlacement) return;
      const d = distance(centers.get(placement.seat.id), centers.get(otherPlacement.seat.id));
      if (d <= ADJACENCY_DISTANCE){
        addWarning(student.id, placement.seat.id, student.name + " must not sit next to " + other.name + ".");
      }
    });
  });

  state.warnings = warnings;
  state.seatWarnMap = seatWarnMap;
}