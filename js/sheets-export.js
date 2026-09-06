"use strict";

/* =========================================================
   EXPORT TO GOOGLE SHEETS (via .xlsx)

   Google Sheets has no way to receive multiple tabs from a plain CSV,
   so this generates a real .xlsx workbook (via the SheetJS library
   loaded from cdnjs) with one sheet per column of seats. Google Sheets
   opens .xlsx files directly, or File > Import > Insert new sheet(s)
   pulls every tab into an existing spreadsheet.

   Seats are grouped into columns by x-position (the same idea as the
   "column" fill pattern in the generator), left to right. Each sheet:
     A1 blank,     B1 = column number
     A2 "SEAT",    B2 "SURNAME:"
     A3.. seat's position within the column (top to bottom)
     B3.. the assigned student's surname (blank if the seat is empty)
   ========================================================= */

const COLUMN_CLUSTER_TOLERANCE = 40; // px — seats within this x-distance count as the same column

function surnameOf(fullName){
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

// Clusters every seat in the room into left-to-right columns by x
// position, then sorts each column's seats top to bottom.
function groupSeatsIntoColumns(){
  const geo = computeSeatGeometry();
  if (geo.seatsInfo.length === 0) return [];

  const sorted = geo.seatsInfo.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const columns = [];
  sorted.forEach(info => {
    let col = columns.find(c => Math.abs(c.x - info.x) <= COLUMN_CLUSTER_TOLERANCE);
    if (!col){
      col = { x: info.x, seats: [] };
      columns.push(col);
    }
    col.seats.push(info);
    // running average keeps a wide column's reference x centered, so
    // later members near its far edge don't drift out of tolerance
    col.x = (col.x * (col.seats.length - 1) + info.x) / col.seats.length;
  });

  columns.sort((a, b) => a.x - b.x);
  columns.forEach(col => col.seats.sort((a, b) => a.y - b.y));
  return columns;
}

function exportToGoogleSheets(){
  if (typeof XLSX === "undefined"){
    alert("The spreadsheet library didn't load — check your internet connection and try again.");
    return;
  }
  if (state.tables.length === 0){
    alert("Add some tables or desks to the room first.");
    return;
  }

  const columns = groupSeatsIntoColumns();
  const wb = XLSX.utils.book_new();
  const usedNames = new Set();

  columns.forEach((col, i) => {
    const colNumber = i + 1;
    const rows = [
      ["", String(colNumber)],
      ["SEAT", "SURNAME:"]
    ];
    col.seats.forEach((info, idx) => {
      rows.push([idx + 1, surnameOf(info.seat.student && info.seat.student.name)]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 8 }, { wch: 22 }];

    let name = String(colNumber);
    while (usedNames.has(name)) name = name + "_"; // guard against any unexpected collision
    usedNames.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  XLSX.writeFile(wb, "seating-plan.xlsx");
}

document.getElementById("exportSheetsBtn").addEventListener("click", exportToGoogleSheets);