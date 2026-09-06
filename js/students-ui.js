"use strict";

/* =========================================================
   SIDEBAR TAB SWITCHING
   ========================================================= */

tabFurnitureBtn.addEventListener("click", () => switchSidebarTab("furniture"));
tabStudentsBtn.addEventListener("click", () => switchSidebarTab("students"));

function switchSidebarTab(which){
  const isStudents = which === "students";
  tabStudentsBtn.classList.toggle("active", isStudents);
  tabFurnitureBtn.classList.toggle("active", !isStudents);
  studentsPanel.classList.toggle("hidden", !isStudents);
  furniturePanel.classList.toggle("hidden", isStudents);
}

/* =========================================================
   IMPORTING STUDENTS
   ========================================================= */

addFromTextBtn.addEventListener("click", () => {
  const names = parseNamesFromPastedText(pasteText.value);
  if (names.length === 0) return;
  addStudentsFromNames(names);
  pasteText.value = "";
  recomputeWarnings();
  renderRoster();
});

csvBtn.addEventListener("click", () => csvInput.click());
csvInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const names = parseNamesFromCSV(String(reader.result));
    if (names.length === 0){
      alert("Couldn't find any names in that CSV.");
      return;
    }
    addStudentsFromNames(names);
    recomputeWarnings();
    renderRoster();
  };
  reader.onerror = () => alert("Couldn't read that file.");
  reader.readAsText(file);
  e.target.value = "";
});

/* =========================================================
   GENERATE SEATING PLAN
   ========================================================= */

generateBtn.addEventListener("click", () => {
  if (state.students.length === 0){
    generateStatus.textContent = "Add some students first.";
    return;
  }
  const totalSeats = state.tables.reduce((sum, t) => sum + t.seatCount, 0);
  if (totalSeats === 0){
    generateStatus.textContent = "Add some tables or desks to the room first.";
    return;
  }

  const result = generateSeatingPlan({
    mode: generateOrder.value,
    pattern: generatePattern.value,
    keepExisting: keepExistingCheckbox.checked
  });

  if (result.seats < state.students.length && result.unplaced > 0){
    generateStatus.textContent = "Placed " + result.placed + " of " + (result.placed + result.unplaced) +
      " students — only " + result.seats + " seats in the room.";
  } else if (result.unplaced > 0){
    generateStatus.textContent = "Placed " + result.placed + " of " + (result.placed + result.unplaced) + " students.";
  } else {
    generateStatus.textContent = "Placed " + result.placed + " student" + (result.placed === 1 ? "" : "s") + ".";
  }
});

/* =========================================================
   ROSTER RENDERING
   ========================================================= */

let expandedStudentId = null; // which card's requirement editor is open
let searchQuery = "";

studentSearch.addEventListener("input", () => {
  searchQuery = studentSearch.value.trim().toLowerCase();
  renderRoster();
});

function renderRoster(){
  rosterList.innerHTML = "";
  rosterCountEl.textContent = state.students.length;
  armedHint.style.display = armedStudentId ? "block" : "none";

  const visible = searchQuery
    ? state.students.filter(s => s.name.toLowerCase().includes(searchQuery))
    : state.students;

  if (state.students.length > 0 && visible.length === 0){
    const empty = document.createElement("div");
    empty.className = "check-empty";
    empty.textContent = "No students match \u201c" + studentSearch.value.trim() + "\u201d.";
    rosterList.appendChild(empty);
  }

  visible.forEach(student => {
    rosterList.appendChild(buildRosterCard(student));
  });

  updateWarningsUI();
}

function buildRosterCard(student){
  const card = document.createElement("div");
  card.className = "roster-card" + (armedStudentId === student.id ? " armed" : "");
  card.draggable = true;
  card.dataset.id = student.id;

  card.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ studentId: student.id }));
    e.dataTransfer.effectAllowed = "copy";
  });

  const row = document.createElement("div");
  row.className = "roster-row";
  row.addEventListener("click", () => setArmedStudent(student.id));

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = initials(student.name);

  const info = document.createElement("div");
  info.className = "roster-info";
  const nameEl = document.createElement("div");
  nameEl.className = "roster-name";
  nameEl.textContent = student.name;
  const statusEl = document.createElement("div");
  statusEl.className = "roster-status";
  const placement = getSeatAssignment(student.id);
  statusEl.textContent = placement ? "Seated · " + placement.table.label : "Unassigned";
  info.appendChild(nameEl);
  info.appendChild(statusEl);

  const actions = document.createElement("div");
  actions.className = "roster-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.title = "Edit requirements";
  editBtn.textContent = "\u270E";
  editBtn.addEventListener("click", e => {
    e.stopPropagation();
    expandedStudentId = (expandedStudentId === student.id) ? null : student.id;
    renderRoster();
  });

  const removeBtn = document.createElement("button");
  removeBtn.className = "icon-btn";
  removeBtn.title = "Remove student";
  removeBtn.textContent = "\u00D7";
  removeBtn.addEventListener("click", e => {
    e.stopPropagation();
    if (!confirm("Remove " + student.name + " from the roster?")) return;
    if (armedStudentId === student.id) clearArmedStudent();
    if (expandedStudentId === student.id) expandedStudentId = null;
    removeStudent(student.id);
    recomputeWarnings();
    renderAll();
    renderRoster();
  });

  actions.appendChild(editBtn);
  actions.appendChild(removeBtn);

  row.appendChild(avatar);
  row.appendChild(info);
  row.appendChild(actions);
  card.appendChild(row);

  const badges = buildRequirementBadges(student);
  if (badges) card.appendChild(badges);

  if (expandedStudentId === student.id){
    card.appendChild(buildEditPanel(student));
  }

  return card;
}

function buildRequirementBadges(student){
  const req = student.requirements;
  const items = [];
  if (req.position === "front") items.push({ cls: "front", text: "Front" });
  if (req.position === "back") items.push({ cls: "back", text: "Back" });
  req.mustSitNextTo.forEach(id => {
    const other = findStudentById(id);
    if (other) items.push({ cls: "next", text: "Next to " + other.name });
  });
  req.mustNotSitNextTo.forEach(id => {
    const other = findStudentById(id);
    if (other) items.push({ cls: "not-next", text: "Not next to " + other.name });
  });
  if (items.length === 0) return null;

  const wrap = document.createElement("div");
  wrap.className = "req-badges";
  items.forEach(it => {
    const span = document.createElement("span");
    span.className = "req-badge " + it.cls;
    span.textContent = it.text;
    wrap.appendChild(span);
  });
  return wrap;
}

function buildEditPanel(student){
  const panel = document.createElement("div");
  panel.className = "edit-panel";
  panel.addEventListener("click", e => e.stopPropagation());
  panel.addEventListener("mousedown", e => e.stopPropagation());

  const posLabel = document.createElement("div");
  posLabel.className = "edit-label";
  posLabel.textContent = "Position in room";
  panel.appendChild(posLabel);

  const posRow = document.createElement("div");
  posRow.className = "pos-row";
  [["front", "Must sit at front"], ["back", "Must sit at back"]].forEach(([pos, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-btn" + (student.requirements.position === pos ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      setPosition(student.id, pos);
      recomputeWarnings();
      renderRoster();
    });
    posRow.appendChild(btn);
  });
  panel.appendChild(posRow);

  panel.appendChild(buildPeopleChecklist(student, "Must sit next to", "mustSitNextTo", toggleNextTo));
  panel.appendChild(buildPeopleChecklist(student, "Must not sit next to", "mustNotSitNextTo", toggleNotNextTo));

  return panel;
}

function buildPeopleChecklist(student, title, field, toggleFn){
  const wrap = document.createElement("div");
  const label = document.createElement("div");
  label.className = "edit-label";
  label.textContent = title;
  wrap.appendChild(label);

  const list = document.createElement("div");
  list.className = "check-list";
  const others = state.students.filter(s => s.id !== student.id);

  if (others.length === 0){
    const empty = document.createElement("div");
    empty.className = "check-empty";
    empty.textContent = "Add more students to set this.";
    list.appendChild(empty);
  }

  others.forEach(other => {
    const item = document.createElement("label");
    item.className = "check-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = student.requirements[field].includes(other.id);
    cb.addEventListener("change", () => {
      toggleFn(student.id, other.id);
      recomputeWarnings();
      renderRoster();
    });
    const span = document.createElement("span");
    span.textContent = other.name;
    item.appendChild(cb);
    item.appendChild(span);
    list.appendChild(item);
  });

  wrap.appendChild(list);
  return wrap;
}

/* =========================================================
   REQUIREMENTS WARNINGS PANEL
   ========================================================= */

warningsToggle.addEventListener("click", () => {
  warningsList.classList.toggle("hidden");
});

function updateWarningsUI(){
  const count = (state.warnings || []).length;
  warningsToggle.textContent = count
    ? "Check requirements — " + count + " issue" + (count === 1 ? "" : "s")
    : "Check requirements — all clear";
  warningsToggle.classList.toggle("has-issues", count > 0);

  warningsList.innerHTML = "";
  (state.warnings || []).forEach(w => {
    const item = document.createElement("div");
    item.className = "warning-item";
    item.textContent = w.message;
    warningsList.appendChild(item);
  });
}

/* initial paint of the (empty) roster and warnings panel */
recomputeWarnings();
renderRoster();