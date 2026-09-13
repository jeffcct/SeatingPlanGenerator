"use strict";

/* =========================================================
   RENDERING
   ========================================================= */

function renderAll(){
  tablesLayer.innerHTML = "";

  state.aisles.forEach(aisle => {
    const div = document.createElement("div");
    div.className = "aisle-el" + (state.selectedAisles.has(aisle.id) ? " selected" : "");
    div.style.left = aisle.x + "px";
    div.dataset.id = aisle.id;
    div.title = "Aisle divider — drag to reposition, Delete to remove";
    div.addEventListener("mousedown", e => onAisleMouseDown(e, aisle));
    tablesLayer.appendChild(div);
  });

  state.tables.forEach(table => {
    const layout = computeLayout(table);
    const div = document.createElement("div");
    div.className = "table-el type-" + table.type + (state.selected.has(table.id) ? " selected" : "");
    div.style.left = table.x + "px";
    div.style.top = table.y + "px";
    div.style.width = layout.w + "px";
    div.style.height = layout.h + "px";
    div.dataset.id = table.id;

    if (layout.tabletop){
      const top = document.createElement("div");
      top.className = "tabletop" + (layout.tabletop.round ? " round" : "");
      top.style.left = layout.tabletop.x + "px";
      top.style.top = layout.tabletop.y + "px";
      top.style.width = layout.tabletop.w + "px";
      top.style.height = layout.tabletop.h + "px";
      top.textContent = table.label;
      attachRename(top, table);
      div.appendChild(top);
    }

    table.seats.forEach((seat, i) => {
      const sd = document.createElement("div");
      const warnMsgs = (state.seatWarnMap && state.seatWarnMap.get(seat.id)) || [];
      let cls = "seat";
      if (seat.student) cls += " occupied";
      if (warnMsgs.length) cls += " warn";
      if (!seat.student && armedStudentId) cls += " armable";
      sd.className = cls;
      sd.style.left = layout.seats[i].x + "px";
      sd.style.top = layout.seats[i].y + "px";
      sd.style.width = layout.seatW + "px";
      sd.style.height = layout.seatH + "px";
      sd.title = "Seat " + (i + 1) + (seat.student ? " — " + seat.student.name : " — unassigned") +
        (warnMsgs.length ? " ⚠ " + warnMsgs.join(" ") : "");
      const textEl = document.createElement("span");
      textEl.className = "seat-text";
      textEl.textContent = seat.student ? seat.student.name : "";
      sd.appendChild(textEl);
      wireSeatInteractions(sd, seat);
      div.appendChild(sd);
    });

    div.addEventListener("mousedown", e => onTableMouseDown(e, table));
    tablesLayer.appendChild(div);
  });

  updateToolbarState();
}

function updateToolbarState(){
  const n = state.selected.size;
  const aisleN = state.selectedAisles.size;
  const totalSeats = state.tables.reduce((sum, t) => sum + t.seatCount, 0);
  const totalStudents = state.students ? state.students.length : 0;
  const seatedCount = state.tables.reduce((sum, t) => sum + t.seats.filter(s => s.student).length, 0);
  tableCountEl.textContent = state.tables.length + " tables · " + totalSeats + " seats · " +
    (state.aisles.length ? state.aisles.length + " aisles · " : "") +
    seatedCount + "/" + totalStudents + " students seated" +
    ((n || aisleN) ? " · " + (n + aisleN) + " selected" : "");

  duplicateBtn.disabled = n === 0;
  deleteBtn.disabled = n === 0 && aisleN === 0;
  rotateBtn.disabled = !Array.from(state.selected).some(id => findTable(id)?.type === "rect");
  seatMinus.disabled = n !== 1;
  seatPlus.disabled = n !== 1 || (n === 1 && findTable(Array.from(state.selected)[0])?.type === "desk");
}

function attachRename(el, table){
  el.addEventListener("dblclick", e => {
    e.stopPropagation();
    el.contentEditable = "true";
    el.focus();
    document.execCommand("selectAll", false, null);
  });
  el.addEventListener("keydown", e => {
    if (e.key === "Enter"){ e.preventDefault(); el.blur(); }
  });
  el.addEventListener("blur", () => {
    el.contentEditable = "false";
    const text = el.textContent.trim();
    table.label = text || table.label;
    el.textContent = table.label;
  });
}