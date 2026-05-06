const NOTES = [
  'C5','B4','A#4','A4','G#4','G4','F#4','F4','E4','D#4','D4','C#4',
  'C4','B3','A#3','A3','G#3','G3','F#3','F3','E3','D#3','D3','C#3','C3'
];
const BLACK = new Set(['C#', 'D#', 'F#', 'G#', 'A#']);
const STEPS_PER_BAR = 16;

const rollEl = document.getElementById('roll');
const playToggle = document.getElementById('playToggle');
const clearBtn = document.getElementById('clear');
const addBarBtn = document.getElementById('addBar');
const removeBarBtn = document.getElementById('removeBar');
const tempoInput = document.getElementById('tempo');
const tempoValue = document.getElementById('tempoValue');
const reverbInput = document.getElementById('reverb');
const reverbValue = document.getElementById('reverbValue');
const stepsValue = document.getElementById('stepsValue');

let steps = 16;
let grid = Array.from({ length: NOTES.length }, () => Array(steps).fill(false));
let playing = false, timer = null, stepPointer = 0, paintValue = true, dragging = false;

const audio = new AudioContext();
const master = audio.createGain(); master.gain.value = 0.2; master.connect(audio.destination);
const dryGain = audio.createGain(); const wetGain = audio.createGain();
const convolver = audio.createConvolver(); const reverbBus = audio.createGain();
dryGain.connect(master); wetGain.connect(master); reverbBus.connect(convolver); convolver.connect(wetGain);

function buildImpulse(seconds = 1.8, decay = 2.5) {
  const length = audio.sampleRate * seconds;
  const impulse = audio.createBuffer(2, length, audio.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}
convolver.buffer = buildImpulse();

function noteFreq(note) {
  const map = { C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11 };
  const m = note.match(/^([A-G]#?)(\d)$/); const midi = (Number(m[2]) + 1) * 12 + map[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function syncStepsText() { stepsValue.textContent = `${steps} steps`; }
function setReverb(val) { const wet = val / 100; wetGain.gain.value = wet; dryGain.gain.value = 1 - wet * 0.6; reverbValue.textContent = `${val}%`; }

function rebuildGrid(newSteps) {
  const old = grid;
  steps = Math.max(STEPS_PER_BAR, newSteps);
  grid = Array.from({ length: NOTES.length }, (_, r) => Array.from({ length: steps }, (_, c) => old[r]?.[c] ?? false));
  rollEl.innerHTML = '';
  rollEl.style.gridTemplateColumns = `repeat(${steps}, minmax(28px, 1fr))`;
  rollEl.style.gridTemplateRows = `repeat(${NOTES.length}, minmax(28px, 1fr))`;
  NOTES.forEach((note, row) => {
    const base = note.slice(0, -1);
    for (let col = 0; col < steps; col++) {
      const cell = document.createElement('button');
      cell.type = 'button'; cell.className = 'cell';
      if (BLACK.has(base)) cell.classList.add('black');
      if ((col + 1) % 4 === 0) cell.classList.add('beat');
      cell.dataset.row = row; cell.dataset.col = col; cell.ariaLabel = `${note}, step ${col + 1}`;
      if (grid[row][col]) cell.classList.add('active');
      rollEl.appendChild(cell);
    }
  });
  syncStepsText();
}

function playNote(freq, duration = 0.22) {
  const now = audio.currentTime, osc = audio.createOscillator(), env = audio.createGain();
  osc.type = 'triangle'; osc.frequency.value = freq;
  env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(0.35, now + 0.01); env.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(env); env.connect(dryGain); env.connect(reverbBus); osc.start(now); osc.stop(now + duration + 0.03);
}
function clearPlayingMarker(){ for (const el of rollEl.children) el.classList.remove('playing'); }
function tick(){ clearPlayingMarker(); for (let r=0;r<NOTES.length;r++){ const idx=r*steps+stepPointer; const el=rollEl.children[idx]; if(el) el.classList.add('playing'); if(grid[r][stepPointer]) playNote(noteFreq(NOTES[r])); } stepPointer=(stepPointer+1)%steps; }
function intervalMs(){ return (60000 / Number(tempoInput.value)) / 4; }
function start(){ if(playing) return; playing=true; playToggle.textContent='Stop'; stepPointer=0; tick(); timer=setInterval(tick, intervalMs()); }
function stop(){ playing=false; playToggle.textContent='Play'; clearInterval(timer); clearPlayingMarker(); }

rollEl.addEventListener('pointerdown',(e)=>{ const c=e.target.closest('.cell'); if(!c) return; dragging=true; const r=+c.dataset.row, col=+c.dataset.col; paintValue=!grid[r][col]; grid[r][col]=paintValue; c.classList.toggle('active',paintValue); });
rollEl.addEventListener('pointermove',(e)=>{ if(!dragging) return; const c=e.target.closest('.cell'); if(!c) return; const r=+c.dataset.row,col=+c.dataset.col; grid[r][col]=paintValue; c.classList.toggle('active',paintValue); });
window.addEventListener('pointerup',()=>{ dragging=false; });
playToggle.addEventListener('click',async()=>{ if(audio.state==='suspended') await audio.resume(); playing?stop():start(); });
clearBtn.addEventListener('click',()=>{ for(let r=0;r<NOTES.length;r++) for(let c=0;c<steps;c++) grid[r][c]=false; for(const el of rollEl.children) el.classList.remove('active'); });
addBarBtn.addEventListener('click',()=>{ rebuildGrid(steps + STEPS_PER_BAR); });
removeBarBtn.addEventListener('click',()=>{ rebuildGrid(steps - STEPS_PER_BAR); stepPointer%=steps; });
tempoInput.addEventListener('input',()=>{ tempoValue.textContent=`${tempoInput.value} BPM`; if(playing){ clearInterval(timer); timer=setInterval(tick, intervalMs()); }});
reverbInput.addEventListener('input',()=>setReverb(Number(reverbInput.value)));

setReverb(Number(reverbInput.value));
rebuildGrid(steps);
