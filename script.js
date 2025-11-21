const rows = [
  "A R W S D J V N G J K L Q C C",
  "B E C Z C A Y P M I T U G B O",
  "R P M B S V G U N A T R S T M",
  "A O E N M A S L I B C H P U M",
  "N S R K J S Z L G T A L U Z A",
  "C I G H A R X C I X W V S B N",
  "H T E I U I D S R Y Z Z H W D",
  "Q O W O L P A C O M M I T X S",
  "U R S A I T A L O K A Y B E N",
  "S Y T W G V A R I A B L E S X B"
];

// WORDS TO FIND
const words = ["PUSH", "BRANCH", "COMMIT", "PULL", "ORIGIN", "MERGE"];

let cells = [];
let selected = [];
let found = new Set();

const grid = document.getElementById("grid");
const wordList = document.getElementById("wordList");

/* =============================
   BUILD GRID
============================= */
rows.forEach((line, r) => {
  line.split(" ").forEach((ch, c) => {
    let cell = document.createElement("div");
    cell.className = "cell";
    cell.innerText = ch;
    cell.dataset.rc = r + "-" + c;

    cell.onclick = () => toggleCell(cell);
    grid.appendChild(cell);
    cells.push(cell);
  });
});

/* =============================
   WORD LIST DISPLAY
============================= */
words.forEach(word => {
  let div = document.createElement("div");
  div.id = "w-" + word;
  div.innerText = word;
  wordList.appendChild(div);
});

/* =============================
   CELL SELECT / UNSELECT
============================= */
function toggleCell(cell) {
  if (cell.classList.contains("found")) return;

  cell.classList.toggle("selected");

  if (cell.classList.contains("selected")) selected.push(cell);
  else selected = selected.filter(c => c !== cell);
}

function selectedWord() {
  return selected.map(c => c.innerText).join("");
}

/* =============================
   BUTTON ACTIONS
============================= */
document.getElementById("checkBtn").onclick = () => {
  let word = selectedWord();

  if (words.includes(word) && !found.has(word)) {
    found.add(word);

    selected.forEach(c => {
      c.classList.remove("selected");
      c.classList.add("found");
    });

    document.getElementById("w-" + word).classList.add("found");
  }

  selected.forEach(c => c.classList.remove("selected"));
  selected = [];
};

// CLEAR BUTTON

document.getElementById("clearBtn").onclick = () => {
  selected.forEach(c => c.classList.remove("selected"));
  selected = [];
};

// REVEAL BUTTON

document.getElementById("revealBtn").onclick = () => {
  found = new Set(words);

  words.forEach(w => {
    document.getElementById("w-" + w).classList.add("found");
  });

  cells.forEach(c => c.classList.add("found"));
};
