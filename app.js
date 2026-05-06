const NOTES = [
  'C5', 'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4',
  'C4', 'B3', 'A#3', 'A3', 'G#3', 'G3', 'F#3', 'F3', 'E3', 'D#3', 'D3', 'C#3', 'C3'
];

const BLACK = new Set(['C#', 'D#', 'F#', 'G#', 'A#']);

const rollEl = document.getElementById('roll');
const playToggle = document.getElementById('playToggle');
const clearBtn = document.getElementById('clear');
const tempoInput = document.getElementById('tempo');
const tempoValue = document.getElementById('tempoValue');
const reverbInput = document.getElementById('reverb');
const reverbValue = document.getElementById('reverbValue');
const stepsInput = document.getElementById('steps');
const stepsValue = document.getElementById('stepsValue');

let steps = Number(stepsInput.value);
let grid = [];
let playing = false;
let timer = null;
let stepPointer = 0;
let paintValue = true;
let dragging = false;

const audio = new AudioContext();
const master = audio.createGain();
master.gain.value = 0.2;
master.connect(audio.destination);

const dryGain = audio.createGain();
const wetGain = audio.createGain();
const convolver = audio.createConvolver();

dryGain.connect(master);
wetGain.connect(master);

const reverbBus = audio.createGain();
reverbBus.gain.value = 0.8;
reverbBus.connect(convolver);
convolver.connect(wetGain);

function buildImpulse(seconds = 1.8, decay = 2.5) {
  const rate = audio.sampleRate;
  const length = rate * seconds;
  const impulse = audio.createBuffer(2, length, rate);
  for (let c = 0; c < impulse.numberOfChannels; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const n = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(n, decay);
    }
  }
  return impulse;
}
convolver.buffer = buildImpulse();

function noteFreq(note) {
  const map = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const m = note.match(/^([A-G]#?)(\d)$/);
  const p = map[m[1]];
  const oct = Number(m[2]);
  const midi = (oct + 1) * 12 + p;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function setReverb(val) {
  const wet = val / 100;
  wetGain.gain.value = wet;
  dryGain.gain.value = 1 - wet * 0.6;
  reverbValue.textContent = `${val}%`;
}

function buildGrid() {
  grid = Array.from({ length: NOTES.length }, () => Array.from({ length: steps }, () => false));
  rollEl.innerHTML = '';
  rollEl.style.gridTemplateColumns = `repeat(${steps}, minmax(28px, 1fr))`;
  rollEl.style.gridTemplateRows = `repeat(${NOTES.length}, minmax(28px, 1fr))`;

  NOTES.forEach((note, row) => {
    const base = note.slice(0, -1);
    for (let col = 0; col < steps; col++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      if (BLACK.has(base)) cell.classList.add('black');
      if ((col + 1) % 4 === 0) cell.classList.add('beat');
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.ariaLabel = `${note}, step ${col + 1}`;
      rollEl.appendChild(cell);
    }
  });

  syncGridToDom();
}

function syncGridToDom() {
  for (const el of rollEl.children) {
    const row = Number(el.dataset.row);
    const col = Number(el.dataset.col);
    el.classList.toggle('active', grid[row][col]);
  }
}

function setCell(row, col, value) {
  grid[row][col] = value;
  const idx = row * steps + col;
  rollEl.children[idx].classList.toggle('active', value);
}

function clearPlayingMarker() {
  for (const el of rollEl.children) el.classList.remove('playing');
}

function playNote(freq, duration = 0.22) {
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.35, now + 0.01);
  env.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(env);
  env.connect(dryGain);
  env.connect(reverbBus);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function tick() {
  clearPlayingMarker();
  for (let row = 0; row < NOTES.length; row++) {
    const idx = row * steps + stepPointer;
    const el = rollEl.children[idx];
    if (el) el.classList.add('playing');
    if (grid[row][stepPointer]) playNote(noteFreq(NOTES[row]));
  }
  stepPointer = (stepPointer + 1) % steps;
}

function intervalMs() {
  const bpm = Number(tempoInput.value);
  return (60_000 / bpm) / 4;
}

function start() {
  if (playing) return;
  playing = true;
  playToggle.textContent = 'Stop';
  stepPointer = 0;
  tick();
  timer = setInterval(tick, intervalMs());
}

function stop() {
  playing = false;
  playToggle.textContent = 'Play';
  clearInterval(timer);
  clearPlayingMarker();
}

rollEl.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  dragging = true;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  paintValue = !grid[row][col];
  setCell(row, col, paintValue);
});

rollEl.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  setCell(Number(cell.dataset.row), Number(cell.dataset.col), paintValue);
});
window.addEventListener('pointerup', () => {
  dragging = false;
});

playToggle.addEventListener('click', async () => {
  if (audio.state === 'suspended') await audio.resume();
  playing ? stop() : start();
});

clearBtn.addEventListener('click', () => {
  for (let r = 0; r < NOTES.length; r++) {
    for (let c = 0; c < steps; c++) grid[r][c] = false;
  }
  syncGridToDom();
});

tempoInput.addEventListener('input', () => {
  tempoValue.textContent = `${tempoInput.value} BPM`;
  if (playing) {
    clearInterval(timer);
    timer = setInterval(tick, intervalMs());
  }
});

reverbInput.addEventListener('input', () => setReverb(Number(reverbInput.value)));

stepsInput.addEventListener('input', () => {
  steps = Number(stepsInput.value);
  stepsValue.textContent = String(steps);
  const old = grid;
  buildGrid();
  for (let r = 0; r < NOTES.length; r++) {
    for (let c = 0; c < Math.min(old[r]?.length ?? 0, steps); c++) {
      grid[r][c] = old[r][c];
    }
  }
  syncGridToDom();
  if (playing) {
    clearInterval(timer);
    stepPointer %= steps;
    timer = setInterval(tick, intervalMs());
  }
});

setReverb(Number(reverbInput.value));
stepsValue.textContent = String(steps);
buildGrid();
