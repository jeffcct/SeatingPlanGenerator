"use strict";

/* =========================================================
   EXPORT TO IMAGE

   Draws the room straight from state.tables (the same geometry
   render.js uses) onto a plain <canvas>, rather than screenshotting
   the DOM — that keeps text crisp at any zoom level and makes the
   output size exactly 1920×1080 (16:9), regardless of how the room
   happens to be laid out or scrolled on screen. Fits into Slides,
   PowerPoint, or any 16:9 deck at full quality.
   ========================================================= */

const EXPORT_W = 1920;
const EXPORT_H = 1080; // 16:9

const EXPORT_COLORS = {
  bgTop: "#1e3f66",
  bgBottom: "#17324f",
  dot: "rgba(255,255,255,.14)",
  headerBg: "rgba(255,255,255,.08)",
  headerText: "rgba(255,255,255,.6)",
  wood: "#b87d4b",
  woodDark: "#935f34",
  woodText: "#ffffff",
  seat: "#f4f6f5",
  seatBorder: "#8fa6be",
  occupied: "#e7b463",
  occupiedBorder: "#c98a2e",
  seatText: "#1c2733"
};

const EXPORT_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function roundRectPath(ctx, x, y, w, h, r){
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// greedy word-wrap into at most maxLines, ellipsizing whatever's left over
function wrapText(ctx, text, maxWidth, maxLines){
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let line = "";
  let i = 0;
  while (i < words.length && lines.length < maxLines){
    const word = words[i];
    const test = line ? line + " " + word : word;
    if (line && ctx.measureText(test).width > maxWidth){
      lines.push(line);
      line = "";
    } else {
      line = test;
      i++;
    }
  }
  if (line && lines.length < maxLines){
    lines.push(line);
  } else if (line && lines.length === maxLines){
    // the last accepted line still has this word pending -> forces ellipsis below
    i--;
  }

  const truncated = i < words.length;
  if (truncated && lines.length){
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(last + "\u2026").width > maxWidth){
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last + "\u2026";
  } else if (lines.length){
    // guard against a single word that alone is wider than the box
    let last = lines[lines.length - 1];
    if (ctx.measureText(last).width > maxWidth){
      while (last.length > 1 && ctx.measureText(last + "\u2026").width > maxWidth){
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = last + "\u2026";
    }
  }
  return lines;
}

function drawCenteredLines(ctx, lines, cx, cy, lineHeight){
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineHeight));
}

function exportSeatingPlanImage(options){
  const testFormat = !!(options && options.testFormat);

  if (state.tables.length === 0){
    alert("Add some tables or desks to the room first.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext("2d");

  // background
  const grad = ctx.createLinearGradient(0, 0, 0, EXPORT_H);
  grad.addColorStop(0, EXPORT_COLORS.bgTop);
  grad.addColorStop(1, EXPORT_COLORS.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);

  // dot grid, matching the in-app canvas
  ctx.fillStyle = EXPORT_COLORS.dot;
  const dotSpacing = 28;
  for (let x = dotSpacing / 2; x < EXPORT_W; x += dotSpacing){
    for (let y = dotSpacing / 2; y < EXPORT_H; y += dotSpacing){
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // "front of room" header bar
  const HEADER_H = 60;
  ctx.fillStyle = EXPORT_COLORS.headerBg;
  ctx.fillRect(0, 0, EXPORT_W, HEADER_H);
  ctx.fillStyle = EXPORT_COLORS.headerText;
  ctx.font = "600 20px " + EXPORT_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(testFormat ? "FRONT OF ROOM \u2014 TEST SEATING" : "FRONT OF ROOM", EXPORT_W / 2, HEADER_H / 2);

  // lay out every table's geometry once, and find the overall bounding box
  const layouts = state.tables.map(t => ({ table: t, layout: computeLayout(t) }));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  layouts.forEach(({ table, layout }) => {
    minX = Math.min(minX, table.x);
    minY = Math.min(minY, table.y);
    maxX = Math.max(maxX, table.x + layout.w);
    maxY = Math.max(maxY, table.y + layout.h);
  });
  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);

  const PAD = 70;
  const availW = EXPORT_W - PAD * 2;
  const availH = EXPORT_H - HEADER_H - PAD * 2;
  const scale = Math.min(availW / contentW, availH / contentH, 4); // cap so a single desk doesn't fill the whole slide
  const offsetX = PAD + (availW - contentW * scale) / 2 - minX * scale;
  const offsetY = HEADER_H + PAD + (availH - contentH * scale) / 2 - minY * scale;

  const X = x => offsetX + x * scale;
  const Y = y => offsetY + y * scale;

  layouts.forEach(({ table, layout }) => {
    const tt = layout.tabletop;

    if (!testFormat && tt){
      const tx = X(table.x + tt.x), ty = Y(table.y + tt.y);
      const tw = tt.w * scale, th = tt.h * scale;

      ctx.fillStyle = EXPORT_COLORS.wood;
      ctx.strokeStyle = EXPORT_COLORS.woodDark;
      ctx.lineWidth = Math.max(1, scale);
      if (tt.round){
        ctx.beginPath();
        ctx.ellipse(tx + tw / 2, ty + th / 2, tw / 2, th / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        roundRectPath(ctx, tx, ty, tw, th, 5 * scale);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = EXPORT_COLORS.woodText;
      ctx.font = "600 " + Math.max(9, 11 * scale) + "px " + EXPORT_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelLines = wrapText(ctx, table.label, tw - 6, 2);
      drawCenteredLines(ctx, labelLines, tx + tw / 2, ty + th / 2, Math.max(10, 12 * scale));
    }

    // Test format for single-seat furniture (desks and spots): since
    // there's no table shape competing for room, use the whole cell —
    // not just the small name pill — to give the name much more space.
    if (testFormat && (table.type === "desk" || table.type === "spot")){
      const margin = 6;
      const bx = X(table.x + margin), by = Y(table.y + margin);
      const bw = (layout.w - margin * 2) * scale, bh = (layout.h - margin * 2) * scale;
      const seat = table.seats[0];

      ctx.fillStyle = seat.student ? EXPORT_COLORS.occupied : EXPORT_COLORS.seat;
      ctx.strokeStyle = seat.student ? EXPORT_COLORS.occupiedBorder : EXPORT_COLORS.seatBorder;
      ctx.lineWidth = Math.max(1, 1.6 * scale);
      roundRectPath(ctx, bx, by, bw, bh, Math.max(3, 6 * scale));
      ctx.fill();
      ctx.stroke();

      if (seat.student){
        ctx.fillStyle = EXPORT_COLORS.seatText;
        ctx.font = "600 " + Math.max(10, 15 * scale) + "px " + EXPORT_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const lines = wrapText(ctx, seat.student.name, bw - 10, 3);
        drawCenteredLines(ctx, lines, bx + bw / 2, by + bh / 2, Math.max(12, 17 * scale));
      }
      return;
    }

    table.seats.forEach((seat, i) => {
      const sx = X(table.x + layout.seats[i].x), sy = Y(table.y + layout.seats[i].y);
      const sw = layout.seatW * scale, sh = layout.seatH * scale;

      ctx.fillStyle = seat.student ? EXPORT_COLORS.occupied : EXPORT_COLORS.seat;
      ctx.strokeStyle = seat.student ? EXPORT_COLORS.occupiedBorder : EXPORT_COLORS.seatBorder;
      ctx.lineWidth = Math.max(1, 1.4 * scale);
      roundRectPath(ctx, sx, sy, sw, sh, Math.max(2, 4 * scale));
      ctx.fill();
      ctx.stroke();

      if (seat.student){
        ctx.fillStyle = EXPORT_COLORS.seatText;
        ctx.font = "600 " + Math.max(7, 8.5 * scale) + "px " + EXPORT_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const nameLines = wrapText(ctx, seat.student.name, sw - 6, 2);
        drawCenteredLines(ctx, nameLines, sx + sw / 2, sy + sh / 2, Math.max(8, 9.5 * scale));
      }
    });
  });

  // aisle dividers — dashed vertical lines spanning the seating area
  if (state.aisles.length){
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.45)";
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.setLineDash([6 * scale, 5 * scale]);
    state.aisles.forEach(aisle => {
      const ax = X(aisle.x);
      ctx.beginPath();
      ctx.moveTo(ax, Y(minY) - 10);
      ctx.lineTo(ax, Y(maxY) + 10);
      ctx.stroke();
    });
    ctx.restore();
  }

  canvas.toBlob(blob => {
    if (!blob){
      alert("Couldn't generate the image — try again.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = testFormat ? "seating-plan-test-format.png" : "seating-plan.png";
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

document.getElementById("exportImageBtn").addEventListener("click", () => exportSeatingPlanImage());
document.getElementById("exportTestBtn").addEventListener("click", () => exportSeatingPlanImage({ testFormat: true }));