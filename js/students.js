"use strict";

/* =========================================================
   STUDENT DATA MODEL

   A student looks like:
     {
       id: 'student-xxx',
       name: 'Ana Rivera',
       requirements: {
         position: null | 'front' | 'back',
         mustSitNextTo: [studentId, ...],
         mustNotSitNextTo: [studentId, ...]
       }
     }

   Seats already carry `seat.student`, populated with a direct reference
   to one of these objects (see assignment.js), so editing a student's
   requirements here is instantly reflected wherever that seat renders.
   ========================================================= */

state.students = [];

function makeStudent(name){
  return {
    id: uid("student"),
    name: name.trim(),
    requirements: {
      position: null,        // null | 'front' | 'back'
      mustSitNextTo: [],     // studentId[]
      mustNotSitNextTo: []   // studentId[]
    }
  };
}

function addStudentsFromNames(names){
  const created = [];
  names.map(n => n.trim()).filter(Boolean).forEach(name => {
    const student = makeStudent(name);
    state.students.push(student);
    created.push(student);
  });
  return created;
}

/* ---- Parsing pasted text: one name per line, or comma-separated ---- */
function parseNamesFromPastedText(text){
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  return text.split(",").map(n => n.trim()).filter(Boolean);
}

/* ---- Parsing a CSV: tolerant of a header row and of first/last-name
   columns. Any row is reduced to a single name by joining its non-empty
   cells with a space (so "Ana,Rivera" becomes "Ana Rivera", and a single
   "Full Name" column just passes through). ---- */
const CSV_HEADER_WORDS = ["name", "student", "student name", "full name", "first name", "last name", "first", "last"];

function parseNamesFromCSV(text){
  const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
  if (rows.length === 0) return [];

  const firstCells = rows[0].split(",").map(c => c.replace(/^"|"$/g, "").trim().toLowerCase());
  const looksLikeHeader = firstCells.some(c => CSV_HEADER_WORDS.includes(c));
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;

  return dataRows
    .map(row => row.split(",").map(c => c.replace(/^"|"$/g, "").trim()).filter(Boolean).join(" "))
    .filter(Boolean);
}

/* ---- Lookup / mutation ---- */
function findStudentById(id){ return state.students.find(s => s.id === id); }

function getSeatAssignment(studentId){
  for (const t of state.tables){
    for (const seat of t.seats){
      if (seat.student && seat.student.id === studentId) return { table: t, seat };
    }
  }
  return null;
}

function removeStudent(id){
  // free up their seat, if any
  state.tables.forEach(t => t.seats.forEach(s => {
    if (s.student && s.student.id === id) s.student = null;
  }));
  // strip references to them from everyone else's requirements
  state.students.forEach(s => {
    s.requirements.mustSitNextTo = s.requirements.mustSitNextTo.filter(x => x !== id);
    s.requirements.mustNotSitNextTo = s.requirements.mustNotSitNextTo.filter(x => x !== id);
  });
  state.students = state.students.filter(s => s.id !== id);
}

function clearAllStudents(){
  state.tables.forEach(t => t.seats.forEach(s => { s.student = null; }));
  state.students = [];
}

function setPosition(studentId, pos){
  const s = findStudentById(studentId);
  if (!s) return;
  s.requirements.position = (s.requirements.position === pos) ? null : pos;
}

function toggleNextTo(studentId, otherId){
  const s = findStudentById(studentId);
  if (!s || studentId === otherId) return;
  const list = s.requirements.mustSitNextTo;
  const idx = list.indexOf(otherId);
  if (idx >= 0) list.splice(idx, 1); else list.push(otherId);
}

function toggleNotNextTo(studentId, otherId){
  const s = findStudentById(studentId);
  if (!s || studentId === otherId) return;
  const list = s.requirements.mustNotSitNextTo;
  const idx = list.indexOf(otherId);
  if (idx >= 0) list.splice(idx, 1); else list.push(otherId);
}