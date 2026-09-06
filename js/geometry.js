"use strict";

/* =========================================================
   GEOMETRY — turns a table's type/seatCount/orientation into
   pixel positions for its tabletop and every seat.

   Seats are rendered as small name-tag pills (wide enough to show a
   full name, up to two lines) rather than plain circles, so every
   formula here works off seatW/seatH instead of a single diameter,
   and tables scale up to keep neighboring name tags from overlapping.
   ========================================================= */

const SEAT_W = 68;
const SEAT_H = 30;
const SEAT_GAP = 10;

function computeLayout(table){
  const seatW = SEAT_W, seatH = SEAT_H;

  if (table.type === "round"){
    const n = Math.max(1, table.seatCount);
    const tableD = Math.max(70, 50 + n * 9);
    // ring radius must be large enough that seats spaced evenly around
    // the circumference don't overlap each other
    const minRingForSpacing = (n * (seatW + SEAT_GAP)) / (2 * Math.PI);
    const ring = Math.max(tableD / 2 + Math.max(seatW, seatH) / 2 + 10, minRingForSpacing);
    const size = Math.ceil(2 * (ring + Math.max(seatW, seatH) / 2) + 8);
    const c = size / 2;
    const seats = [];
    for (let i = 0; i < n; i++){
      const angle = -Math.PI / 2 + i * (2 * Math.PI / n);
      seats.push({
        x: c + ring * Math.cos(angle) - seatW / 2,
        y: c + ring * Math.sin(angle) - seatH / 2
      });
    }
    return { w: size, h: size, seatW, seatH, seats,
      tabletop: { x: c - tableD / 2, y: c - tableD / 2, w: tableD, h: tableD, round: true } };
  }

  if (table.type === "rect"){
    const n = Math.max(1, table.seatCount);
    const top = Math.ceil(n / 2), bottom = Math.floor(n / 2);
    const maxSide = Math.max(top, bottom, 1);
    const seats = [];

    if (table.orientation === "vertical"){
      // seats stack top-to-bottom along the left/right edges, so the
      // slot size along that edge is based on seat height
      const slot = seatH + SEAT_GAP;
      const extent = Math.max(maxSide * slot, 100);
      const tW = 50, tH = extent;
      const w = tW + 2 * (seatW + 12), h = tH + 20;
      const tx = seatW + 12, ty = 10;
      for (let i = 0; i < top; i++)
        seats.push({ x: tx - seatW - 6, y: ty + (i + 0.5) * (tH / top) - seatH / 2 });
      for (let i = 0; i < bottom; i++)
        seats.push({ x: tx + tW + 6, y: ty + (i + 0.5) * (tH / bottom) - seatH / 2 });
      return { w, h, seatW, seatH, seats, tabletop: { x: tx, y: ty, w: tW, h: tH, round: false } };
    } else {
      // seats sit side-by-side along the top/bottom edges, so the slot
      // size along that edge is based on seat width
      const slot = seatW + SEAT_GAP;
      const extent = Math.max(maxSide * slot, 100);
      const tW = extent, tH = 50;
      const w = tW + 20, h = tH + 2 * (seatH + 14);
      const tx = 10, ty = seatH + 14;
      for (let i = 0; i < top; i++)
        seats.push({ x: tx + (i + 0.5) * (tW / top) - seatW / 2, y: ty - seatH - 8 });
      for (let i = 0; i < bottom; i++)
        seats.push({ x: tx + (i + 0.5) * (tW / bottom) - seatW / 2, y: ty + tH + 8 });
      return { w, h, seatW, seatH, seats, tabletop: { x: tx, y: ty, w: tW, h: tH, round: false } };
    }
  }

  if (table.type === "spot"){
    // just a name marker — no table shape, no extra footprint beyond
    // the seat pill itself plus a small margin
    const margin = 8;
    const w = seatW + margin * 2, h = seatH + margin * 2;
    return {
      w, h, seatW, seatH,
      seats: [{ x: margin, y: margin }],
      tabletop: null
    };
  }

  // desk: a single seat below it
  const dW = 56, dH = 36;
  const w = Math.max(dW + 24, seatW + 20);
  const h = dH + seatH + 26;
  return {
    w, h, seatW, seatH,
    seats: [{ x: w / 2 - seatW / 2, y: dH + 18 }],
    tabletop: { x: w / 2 - dW / 2, y: 10, w: dW, h: dH, round: false }
  };
}

function initials(name){
  return name.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join("").toUpperCase();
}