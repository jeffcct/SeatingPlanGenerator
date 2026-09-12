"use strict";

/* =========================================================
   GENERATING A SEATING PLAN

   Order (alphabetical / random) only decides how students are filled
   into whichever seats are left AFTER requirements have first claimed
   theirs — a "must sit at back" student is seated before the ordering
   ever gets a say. "Must/must not sit next to" is optimized for on a
   best-effort basis: partners are moved to sit back-to-back in the
   placement queue (see clusterByNextTo below) so nothing else gets a
   chance to claim the seat next to the first partner before the second
   one is placed, and each placement scores candidate seats by row and
   section (see computeSeatSections in js/assignment.js) relative to
   already-placed partners: "must sit next to" wants the exact same row
   and section, "must not sit next to" avoids the same or a neighbouring
   row within that same section — an aisle divider between two seats
   means they're in different sections and neither rule applies. Run
   "Check requirements" afterward for anything that couldn't be satisfied
   (usually not enough seats in a zone, or a next-to/not-next-to pair that
   conflicted with something else, e.g. one partner required front and the
   other required back).
   ========================================================= */

function shuffle(list){
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function orderStudents(students, mode){
  if (mode === "random") return shuffle(students);
  return students.slice().sort((a, b) => a.name.localeCompare(b.name));
}

function wantsNextTo(a, b){
  return a.requirements.mustSitNextTo.includes(b.id) || b.requirements.mustSitNextTo.includes(a.id);
}
function forbidsNextTo(a, b){
  return a.requirements.mustNotSitNextTo.includes(b.id) || b.requirements.mustNotSitNextTo.includes(a.id);
}

// Groups students connected by "must sit next to" into clusters (via
// union-find, so a chain of pairwise requirements becomes one cluster
// even if only one side of each pair declared it), then rewrites a
// placement order so every cluster's members appear consecutively —
// preserving their relative order otherwise. This is what makes the
// generator actually able to seat requested pairs/groups together,
// instead of leaving it to chance whether they end up near each other
// in the alphabetical/random order.
function clusterByNextTo(order){
  const parent = new Map();
  order.forEach(s => parent.set(s.id, s.id));
  function find(id){
    while (parent.get(id) !== id) id = parent.get(id);
    return id;
  }
  function union(a, b){
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  order.forEach(s => {
    s.requirements.mustSitNextTo.forEach(otherId => {
      if (parent.has(otherId)) union(s.id, otherId);
    });
  });

  const clusterOf = new Map();
  order.forEach(s => {
    const root = find(s.id);
    if (!clusterOf.has(root)) clusterOf.set(root, []);
    clusterOf.get(root).push(s);
  });

  const placed = new Set();
  const result = [];
  order.forEach(student => {
    if (placed.has(student.id)) return;
    const cluster = clusterOf.get(find(student.id));
    cluster.forEach(member => {
      if (!placed.has(member.id)){
        result.push(member);
        placed.add(member.id);
      }
    });
  });
  return result;
}

/**
 * options:
 *   mode: 'alphabetical' | 'random'
 *   pattern: 'row' | 'column' — how seats are traversed when the chosen
 *     order fills them: row-by-row (top to bottom, left to right within
 *     a row) or column-by-column (left to right, top to bottom within
 *     a column).
 *   keepExisting: boolean — if true, currently-seated students are left
 *     alone and only currently-unseated students are placed into
 *     currently-empty seats; if false, the whole room is cleared first.
 * returns { placed, unplaced, seats }
 */
function generateSeatingPlan(options){
  const mode = (options && options.mode === "random") ? "random" : "alphabetical";
  const pattern = (options && options.pattern === "column") ? "column" : "row";
  const keepExisting = !!(options && options.keepExisting);

  const geo = computeSeatGeometry();
  if (geo.seatsInfo.length === 0){
    return { placed: 0, unplaced: state.students.length, seats: 0 };
  }

  const seatOrder = pattern === "column"
    ? geo.seatsInfo.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y))   // left to right, then top to bottom
    : geo.seatsInfo.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));  // top to bottom, then left to right
  const seatInfoById = new Map(seatOrder.map(info => [info.seat.id, info]));

  const claimedSeatIds = new Set();    // seats already spoken for this run
  const placedForStudent = new Map();  // studentId -> seatId (for adjacency scoring)

  let studentsToPlace;
  if (keepExisting){
    seatOrder.forEach(info => {
      if (info.seat.student){
        claimedSeatIds.add(info.seat.id);
        placedForStudent.set(info.seat.student.id, info.seat.id);
      }
    });
    studentsToPlace = state.students.filter(s => !getSeatAssignment(s.id));
  } else {
    state.tables.forEach(t => t.seats.forEach(s => { s.student = null; }));
    studentsToPlace = state.students.slice();
  }

  function zoneOf(info){
    if (!geo.hasRange) return "middle";
    if (info.y >= geo.backThreshold) return "back";
    if (info.y <= geo.frontThreshold) return "front";
    return "middle";
  }

  function availableSeats(){
    return seatOrder.filter(info => !claimedSeatIds.has(info.seat.id));
  }

  function scoreSeat(student, info){
    let score = 0;
    placedForStudent.forEach((seatId, otherId) => {
      const other = findStudentById(otherId);
      const otherInfo = seatInfoById.get(seatId);
      if (!other || !otherInfo) return;
      const sameSection = inSameSection(geo.sectionIndexBySeatId, info.seat.id, seatId);
      // "must sit next to" means the same row and the same section (no
      // aisle divider between them) — sharing just a row isn't enough
      if (wantsNextTo(student, other) && sameSection && inSameRow(geo.rowIndexBySeatId, info.seat.id, seatId)) score += 1000;
      // "must not sit next to" is room-scale: same or neighbouring row,
      // and the same section — an aisle between them makes it fine even
      // in the same or an adjacent row
      if (forbidsNextTo(student, other) && sameSection && inSameOrNeighbouringRow(geo.rowIndexBySeatId, info.seat.id, seatId)) score -= 1000;
    });
    // among several seats that all qualify for a required zone, prefer
    // the one furthest in that direction — otherwise a seat that just
    // barely qualifies as "back" (e.g. the front row of a table near
    // the zone boundary) can get claimed first, leaving the room's
    // actual back-most seats empty
    if (student.requirements.position && geo.hasRange){
      const range = geo.maxY - geo.minY || 1;
      if (student.requirements.position === "back") score += ((info.y - geo.minY) / range) * 10;
      if (student.requirements.position === "front") score += ((geo.maxY - info.y) / range) * 10;
    }
    return score;
  }

  function pickSeatFor(student){
    let candidates = availableSeats();
    if (candidates.length === 0) return null;

    if (student.requirements.position){
      const inZone = candidates.filter(info => zoneOf(info) === student.requirements.position);
      // if the required zone is already full, fall back to whatever's left —
      // "Check requirements" will surface the shortfall afterward
      if (inZone.length > 0) candidates = inZone;
    }

    let best = candidates[0], bestScore = -Infinity;
    candidates.forEach(info => {
      const s = scoreSeat(student, info);
      if (s > bestScore){ bestScore = s; best = info; }
    });
    return best;
  }

  // requirements first: front/back-required students are placed before
  // the chosen order gets to decide anything, so a requirement always
  // wins a seat over plain alphabetical/random fill
  const positioned = studentsToPlace.filter(s => s.requirements.position);
  const unpositioned = studentsToPlace.filter(s => !s.requirements.position);
  const frontGroup = orderStudents(positioned.filter(s => s.requirements.position === "front"), mode);
  const backGroup = orderStudents(positioned.filter(s => s.requirements.position === "back"), mode);
  const restGroup = orderStudents(unpositioned, mode);
  const rawOrder = frontGroup.concat(backGroup, restGroup);

  // pull "must sit next to" partners together so nothing else can claim
  // the seat next to the first partner before the second is placed
  const placementOrder = clusterByNextTo(rawOrder);

  let placedCount = 0;
  placementOrder.forEach(student => {
    const info = pickSeatFor(student);
    if (!info) return; // ran out of seats
    info.seat.student = student;
    claimedSeatIds.add(info.seat.id);
    placedForStudent.set(student.id, info.seat.id);
    placedCount++;
  });

  recomputeWarnings();
  renderAll();
  renderRoster();

  return {
    placed: placedCount,
    unplaced: placementOrder.length - placedCount,
    seats: seatOrder.length
  };
}