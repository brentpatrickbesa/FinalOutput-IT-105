const GRID_SIZE = 12;
const words = [
  "GITHUB","JAVASCRIPT","VARIABLES","COMMANDS",
  "PUSH","BRANCH","COMMIT","PULL",
  "ORIGIN","MERGE","REPOSITORY","COLLAB"
];

// scoring rules
const POINTS_PER_WORD = 10;

// grid data
let grid = [];
let placements = {};     // word -> {coords: [{r,c},...], dir}
let foundWords = new Set();

// selection state
let selecting = false;
let selectionStart = null;
let currentSelection = [];

// timer & score
let timerInterval = null;
let secondsElapsed = 0;
let timerRunning = false;
let score = 0;

// DOM refs
const gridEl = document.getElementById('grid');
const cardsEl = document.getElementById('cards');
const counterEl = document.getElementById('counter');
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const shuffleBtn = document.getElementById('shuffle');
const hintBtn = document.getElementById('hint');
const resetTimerBtn = document.getElementById('resetTimer');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const modalText = document.getElementById('modalText');

// direction vectors
const directions = [
  {dr:0, dc:1},   // right
  {dr:0, dc:-1},  // left
  {dr:1, dc:0},   // down
  {dr:-1, dc:0},  // up
  {dr:1, dc:1},   // down-right
  {dr:-1, dc:-1}, // up-left
  {dr:1, dc:-1},  // down-left
  {dr:-1, dc:1}   // up-right
];

// --- sound utilities: use WebAudio for tiny sounds ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioContext ? new AudioContext() : null;

function playSelectSound(){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.value = 880;
  g.gain.value = 0.02;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  o.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
  setTimeout(()=> o.stop(), 140);
}
function playSuccessSound(){
  if(!audioCtx) return;
  const now = audioCtx.currentTime;
  // a short melodic flourish
  const notes = [660,880,990];
  notes.forEach((freq, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.value = 0.02;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(now + i*0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i*0.06 + 0.12);
    setTimeout(()=> o.stop(), (i+1)*120);
  });
}

// utility
function randInt(max){ return Math.floor(Math.random()*max); }

// --- grid creation ---
function createGridDOM(){
  grid = [];
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 46px)`;
  for(let r=0;r<GRID_SIZE;r++){
    const row = [];
    for(let c=0;c<GRID_SIZE;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('data-r', r);
      cell.setAttribute('data-c', c);
      cell.setAttribute('tabindex', '0');
      gridEl.appendChild(cell);
      row.push({char:'', el: cell, found:false});
    }
    grid.push(row);
  }
}

// place words randomly with collision allowing matching letters
function placeWords(){
  placements = {};
  // clear
  for(let r=0;r<GRID_SIZE;r++) for(let c=0;c<GRID_SIZE;c++) grid[r][c].char='';

  for(const raw of words){
    const word = raw.toUpperCase();
    let placed = false;
    let attempts = 0;
    while(!placed && attempts < 500){
      attempts++;
      const dir = directions[randInt(directions.length)];
      const len = word.length;
      const sr = randInt(GRID_SIZE);
      const sc = randInt(GRID_SIZE);
      const er = sr + dir.dr*(len-1);
      const ec = sc + dir.dc*(len-1);
      if(er < 0 || er >= GRID_SIZE || ec < 0 || ec >= GRID_SIZE) continue;

      let ok = true;
      const coords = [];
      for(let i=0;i<len;i++){
        const r = sr + dir.dr*i;
        const c = sc + dir.dc*i;
        const existing = grid[r][c].char;
        if(existing && existing !== word[i]) { ok = false; break; }
        coords.push({r,c});
      }
      if(!ok) continue;
      // commit
      coords.forEach((p,i) => grid[p.r][p.c].char = word[i]);
      placements[word] = {coords, dir};
      placed = true;
    }

    if(!placed){
      // fallback: place left-to-right in first available row
      for(let r=0;r<GRID_SIZE && !placed;r++){
        for(let c=0;c<=GRID_SIZE-word.length && !placed;c++){
          let ok = true;
          for(let k=0;k<word.length;k++){
            const ex = grid[r][c+k].char;
            if(ex && ex !== word[k]) { ok=false; break; }
          }
          if(ok){
            const coords = [];
            for(let k=0;k<word.length;k++){
              grid[r][c+k].char = word[k];
              coords.push({r,c: c+k});
            }
            placements[word] = {coords, dir: {dr:0,dc:1}};
            placed = true;
          }
        }
      }
    }
    if(!placed) console.warn("Could not place word", word);
  }
}

// fill rest with random letters
function fillRandom(){
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      if(!grid[r][c].char) grid[r][c].char = letters[randInt(letters.length)];
      grid[r][c].el.textContent = grid[r][c].char;
      grid[r][c].el.classList.remove('found','selected');
      grid[r][c].found = false;
    }
  }
}

// render cards
function renderCards(){
  cardsEl.innerHTML = '';
  // create cards with 4 words each to resemble original layout in three columns
  const groups = [0,1,2].map(i => words.slice(i*4, i*4+4));
  groups.forEach(group => {
    const card = document.createElement('div');
    card.className = 'card';
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.alignItems = 'center';
    list.style.gap = '8px';
    group.forEach(w => {
      const it = document.createElement('div');
      it.className = 'word-item';
      it.textContent = w;
      it.dataset.word = w;
      list.appendChild(it);
    });
    card.appendChild(list);
    cardsEl.appendChild(card);
  });
  updateCardsFound();
}

function updateCardsFound(){
  const items = cardsEl.querySelectorAll('.word-item');
  items.forEach(it=>{
    const w = it.dataset.word;
    if(foundWords.has(w)){
      it.classList.add('found');
      // mark owning card
      const card = it.closest('.card');
      if(card) card.classList.add('found');
    } else {
      it.classList.remove('found');
      const card = it.closest('.card');
      if(card) card.classList.remove('found');
    }
  });
  counterEl.textContent = `${foundWords.size} / ${words.length} found`;
  scoreEl.textContent = score;
}

// --- selection logic (draggable) ---
function clearSelectionVisuals(){
  currentSelection.forEach(p => grid[p.r][p.c].el.classList.remove('selected'));
}

function startSelection(r,c){
  // start timer if not running
  startTimerOnce();
  selecting = true;
  selectionStart = {r,c};
  currentSelection = [{r,c}];
  grid[r][c].el.classList.add('selected');
  playSelectSound();
}

function updateSelection(r,c){
  if(!selecting || !selectionStart) return;
  const dr = r - selectionStart.r;
  const dc = c - selectionStart.c;
  // invalid line?
  if(!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) {
    // do not update - keep current selection (only allow straight / diagonal)
    return;
  }
  const stepR = dr === 0 ? 0 : (dr / Math.abs(dr));
  const stepC = dc === 0 ? 0 : (dc / Math.abs(dc));
  const length = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  clearSelectionVisuals();
  currentSelection = [];
  for(let i=0;i<length;i++){
    const nr = selectionStart.r + stepR*i;
    const nc = selectionStart.c + stepC*i;
    if(nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) break;
    currentSelection.push({r:nr,c:nc});
    grid[nr][nc].el.classList.add('selected');
  }
  playSelectSound();
}

function finalizeSelection(){
  if(!selecting) return;
  if(currentSelection.length === 0){
    selecting = false;
    selectionStart = null;
    return;
  }
  // build string and reverse
  const seq = currentSelection.map(p => grid[p.r][p.c].char).join('');
  const rev = seq.split('').reverse().join('');
  let matched = null;
  for(const w of Object.keys(placements)){
    if(foundWords.has(w)) continue;
    if(w === seq || w === rev){
      matched = w; break;
    }
  }
  if(matched){
    // mark found
    currentSelection.forEach(p => {
      grid[p.r][p.c].el.classList.add('found');
      grid[p.r][p.c].found = true;
    });
    foundWords.add(matched);
    score += POINTS_PER_WORD;
    updateCardsFound();
    playSuccessSound();
    // completed?
    if(foundWords.size === words.length){
      stopTimer();
      showModal();
    }
  }
  // clear selection visuals after short delay to show selection
  setTimeout(()=> {
    clearSelectionVisuals();
    currentSelection = [];
    selecting = false;
    selectionStart = null;
  }, 80);
}

// mouse & touch handling
function setupInteractions(){
  // mouse
  gridEl.addEventListener('mousedown', e => {
    const el = e.target.closest('.cell');
    if(!el) return;
    const r = +el.dataset.r, c = +el.dataset.c;
    startSelection(r,c);
    e.preventDefault();
  });

  document.addEventListener('mouseup', e => {
    if(selecting) finalizeSelection();
  });

  gridEl.addEventListener('mousemove', e => {
    if(!selecting) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.cell');
    if(!el) return;
    const r = +el.dataset.r, c = +el.dataset.c;
    updateSelection(r,c);
  });

  // click fallback (quick click)
  gridEl.addEventListener('click', e => {
    // if not selecting or tiny click selection -> check single-letter start+finish
    // handled in mousedown/mouseup combination; keep click no-op to avoid double.
  });

  // touch
  gridEl.addEventListener('touchstart', e => {
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY)?.closest?.('.cell');
    if(!el) return;
    const r = +el.dataset.r, c = +el.dataset.c;
    startSelection(r,c);
    e.preventDefault();
  }, {passive:false});

  gridEl.addEventListener('touchmove', e => {
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY)?.closest?.('.cell');
    if(!el) return;
    const r = +el.dataset.r, c = +el.dataset.c;
    updateSelection(r,c);
    e.preventDefault();
  }, {passive:false});

  gridEl.addEventListener('touchend', e => {
    if(selecting) finalizeSelection();
  });

  // keyboard navigation support (basic)
  gridEl.addEventListener('keydown', e => {
    const el = document.activeElement;
    if(!el || !el.classList.contains('cell')) return;
    const r = +el.dataset.r, c = +el.dataset.c;
    if(e.key === 'Enter'){
      if(!selecting) startSelection(r,c);
      else { updateSelection(r,c); finalizeSelection(); }
      e.preventDefault();
    } else if(e.key === 'Escape'){
      clearSelectionVisuals();
      currentSelection = []; selecting = false; selectionStart = null;
    } else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      let nr=r, nc=c;
      if(e.key === 'ArrowUp') nr = Math.max(0, r-1);
      if(e.key === 'ArrowDown') nr = Math.min(GRID_SIZE-1, r+1);
      if(e.key === 'ArrowLeft') nc = Math.max(0, c-1);
      if(e.key === 'ArrowRight') nc = Math.min(GRID_SIZE-1, c+1);
      grid[nr][nc].el.focus();
      e.preventDefault();
    }
  }, true);

  // controls
  shuffleBtn.addEventListener('click', () => generateNewPuzzle());
  hintBtn.addEventListener('click', () => giveHint());
  resetTimerBtn.addEventListener('click', () => resetTimer());
  closeModal.addEventListener('click', () => hideModal());
  modal.addEventListener('click', e => { if(e.target === modal) hideModal(); });
}

// --- timer functions ---
function startTimerOnce(){
  if(timerRunning) return;
  timerRunning = true;
  timerInterval = setInterval(()=> {
    secondsElapsed++;
    timerEl.textContent = formatTime(secondsElapsed);
  }, 1000);
}
function stopTimer(){
  timerRunning = false;
  if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
}
function resetTimer(){
  stopTimer();
  secondsElapsed = 0;
  timerEl.textContent = formatTime(secondsElapsed);
  timerRunning = false;
}
function formatTime(s){
  const mm = Math.floor(s/60).toString().padStart(2,'0');
  const ss = (s%60).toString().padStart(2,'0');
  return `${mm}:${ss}`;
}

// --- hint ---
function giveHint(){
  // pick a random unfound word and highlight one of its letters
  const unfound = words.filter(w => !foundWords.has(w));
  if(unfound.length === 0) return;
  const pick = unfound[randInt(unfound.length)];
  const info = placements[pick];
  if(!info) return;
  const pos = info.coords[randInt(info.coords.length)];
  const el = grid[pos.r][pos.c].el;
  el.classList.add('selected');
  setTimeout(()=> el.classList.remove('selected'), 900);
}

// --- modal ---
function showModal(){
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  modalText.textContent = `You found all words in ${formatTime(secondsElapsed)} — score ${score}.`;
}
function hideModal(){
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
}

// --- puzzle generator ---
function generateNewPuzzle(){
  // reset state
  stopTimer();
  secondsElapsed = 0; timerEl.textContent = formatTime(0); timerRunning = false;
  score = 0; scoreEl.textContent = score;
  foundWords.clear();
  selectionStart = null; currentSelection = []; selecting = false;
  // build
  createGridDOM();
  placeWords();
  fillRandom();
  renderCards();
  // for accessibility and debugging: log placements
  console.log('Placements:', placements);
}

// start/stop helpers integrated above
function createGridDOM(){ createGridDOM_impl(); }
function createGridDOM_impl(){
  grid = [];
  gridEl.innerHTML = '';
  for(let r=0;r<GRID_SIZE;r++){
    const row = [];
    for(let c=0;c<GRID_SIZE;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.tabIndex = 0;
      gridEl.appendChild(cell);
      row.push({char:'', el:cell, found:false});
    }
    grid.push(row);
  }
}

function placeWords(){ placeWords_impl(); }
function placeWords_impl(){
  placements = {};
  for(let r=0;r<GRID_SIZE;r++) for(let c=0;c<GRID_SIZE;c++) grid[r][c].char = '';
  for(const raw of words){
    const word = raw.toUpperCase();
    let placed=false, tries=0;
    while(!placed && tries < 500){
      tries++;
      const dir = directions[randInt(directions.length)];
      const len = word.length;
      const sr = randInt(GRID_SIZE), sc = randInt(GRID_SIZE);
      const er = sr + dir.dr*(len-1), ec = sc + dir.dc*(len-1);
      if(er < 0 || er >= GRID_SIZE || ec < 0 || ec >= GRID_SIZE) continue;
      let ok=true; const coords=[];
      for(let i=0;i<len;i++){
        const r=sr+dir.dr*i, c=sc+dir.dc*i;
        const ex = grid[r][c].char;
        if(ex && ex !== word[i]){ ok=false; break; }
        coords.push({r,c});
      }
      if(!ok) continue;
      coords.forEach((p,i)=> grid[p.r][p.c].char = word[i]);
      placements[word] = {coords, dir};
      placed = true;
    }
    if(!placed){
      for(let r=0;r<GRID_SIZE && !placed;r++){
        for(let c=0;c<=GRID_SIZE-word.length && !placed;c++){
          let ok=true; for(let k=0;k<word.length;k++){
            const ex = grid[r][c+k].char;
            if(ex && ex !== word[k]){ ok=false; break; }
          }
          if(ok){
            const coords=[];
            for(let k=0;k<word.length;k++){
              grid[r][c+k].char = word[k];
              coords.push({r, c: c+k});
            }
            placements[word] = {coords, dir:{dr:0,dc:1}};
            placed = true;
          }
        }
      }
    }
    if(!placed) console.warn('fail place', word);
  }
}

function fillRandom(){ fillRandom_impl(); }
function fillRandom_impl(){
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      if(!grid[r][c].char) grid[r][c].char = letters[randInt(letters.length)];
      const el = grid[r][c].el;
      el.textContent = grid[r][c].char;
      el.classList.remove('found','selected');
      grid[r][c].found = false;
    }
  }
}

function renderCards(){ renderCards_impl(); }
function renderCards_impl(){
  cardsEl.innerHTML = '';
  // three columns of up to 4 words each
  const per = 4;
  for(let i=0;i<3;i++){
    const group = words.slice(i*per, i*per+per);
    const card = document.createElement('div');
    card.className = 'card';
    const list = document.createElement('div');
    list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='8px'; list.style.alignItems='center';
    group.forEach(w=>{
      const it = document.createElement('div');
      it.className = 'word-item';
      it.textContent = w;
      it.dataset.word = w;
      list.appendChild(it);
    });
    card.appendChild(list); cardsEl.appendChild(card);
  }
  updateCardsFound();
}

// init
generateNewPuzzle();
setupInteractions();