"use strict";

/* =========================================================
   DOM REFERENCES
   Centralised here so every other file can rely on these
   being ready, since this loads before render/interactions/toolbar.
   ========================================================= */

const room = document.getElementById("room");
const tablesLayer = document.getElementById("tablesLayer");
const tableCountEl = document.getElementById("tableCount");

const duplicateBtn = document.getElementById("duplicateBtn");
const deleteBtn = document.getElementById("deleteBtn");
const rotateBtn = document.getElementById("rotateBtn");
const seatMinus = document.getElementById("seatMinus");
const seatPlus = document.getElementById("seatPlus");

const paletteEl = document.getElementById("palette");
const importFile = document.getElementById("importFile");

/* ---- Sidebar tabs ---- */
const tabFurnitureBtn = document.getElementById("tabFurniture");
const tabStudentsBtn = document.getElementById("tabStudents");
const furniturePanel = document.getElementById("furniturePanel");
const studentsPanel = document.getElementById("studentsPanel");

/* ---- Student import ---- */
const pasteText = document.getElementById("pasteText");
const addFromTextBtn = document.getElementById("addFromTextBtn");
const csvBtn = document.getElementById("csvBtn");
const csvInput = document.getElementById("csvInput");

/* ---- Roster ---- */
const rosterList = document.getElementById("rosterList");
const rosterCountEl = document.getElementById("rosterCount");
const armedHint = document.getElementById("armedHint");
const studentSearch = document.getElementById("studentSearch");

/* ---- Generate seating plan ---- */
const generateOrder = document.getElementById("generateOrder");
const generatePattern = document.getElementById("generatePattern");
const keepExistingCheckbox = document.getElementById("keepExistingCheckbox");
const generateBtn = document.getElementById("generateBtn");
const generateStatus = document.getElementById("generateStatus");

/* ---- Requirements check ---- */
const warningsToggle = document.getElementById("warningsToggle");
const warningsList = document.getElementById("warningsList");