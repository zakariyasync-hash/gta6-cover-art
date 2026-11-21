// Neon Coast Cover Studio — editor wiring, written fresh in this session.
// Pick a layout and a grade, load photos into panels (click a panel, then
// choose a file, or fill every panel with one photo), drag a panel to
// reposition its photo, type the title and subtitle, and export the cover
// as a PNG in 1080 x 1080, 1080 x 1350 or 1920 x 1080. A `?shot=` query
// sets up a fixed scene for a screenshot instead (./shots.js).
import { renderPoster, exportPoster, PANEL_LAYOUTS, COLOUR_GRADES, POSTER_SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const photoInput = document.getElementById('photo');
const zoomInput = document.getElementById('zoom');

const state = {
  layout: 'hero',
  grade: 'sunset',
  size: 'wide',
  title: 'Neon Coast',
  subtitle: 'sunset run',
  titleFont: 'anton',
  titlePos: 'bottom',
  frame: true,
  grain: true,
  vignette: true,
  panels: Array.from({ length: 9 }, () => ({ photo: null, zoom: 1, ox: 0, oy: 0 })),
};

let selectedPanel = 0;
let lastRects = [];
let dragging = null;

function repaint() {
  lastRects = renderPoster(canvas, state);
  document.querySelectorAll('[data-panel]').forEach((el) => {
    el.classList.toggle('selected', Number(el.dataset.panel) === selectedPanel);
  });
  zoomInput.value = String(Math.round((state.panels[selectedPanel].zoom || 1) * 100));
}

function applySize() {
  const size = POSTER_SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  repaint();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Puts the loaded photo into panel `i` (and selects that panel). */
export function setPanelPhoto(i, img) {
  state.panels[i] = { photo: img, zoom: 1, ox: 0, oy: 0 };
  selectedPanel = i;
  repaint();
}

// --- Choice buttons: layout, grade, size -------------------------------------

function buildChoices(containerId, entries, key) {
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  for (const [value, info] of Object.entries(entries)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.textContent = info.label;
    b.title = info.hint || info.label;
    b.addEventListener('click', () => {
      state[key] = value;
      if (key === 'size') applySize();
      else repaint();
      box.querySelectorAll('.choice').forEach((el) => el.classList.remove('active'));
      b.classList.add('active');
    });
    if (state[key] === value) b.classList.add('active');
    box.appendChild(b);
  }
}
buildChoices('layouts', PANEL_LAYOUTS, 'layout');
buildChoices('grades', COLOUR_GRADES, 'grade');
buildChoices('sizes', Object.fromEntries(
  Object.entries(POSTER_SIZES).map(([k, v]) => [k, { label: v.label }]),
), 'size');

titleInput.addEventListener('input', () => { state.title = titleInput.value; repaint(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; repaint(); });
document.getElementById('titleFont').addEventListener('change', (e) => { state.titleFont = e.target.value; repaint(); });
document.getElementById('titlePos').addEventListener('change', (e) => { state.titlePos = e.target.value; repaint(); });
document.getElementById('frame').addEventListener('change', (e) => { state.frame = e.target.checked; repaint(); });
document.getElementById('grain').addEventListener('change', (e) => { state.grain = e.target.checked; repaint(); });
document.getElementById('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; repaint(); });
zoomInput.addEventListener('input', () => {
  state.panels[selectedPanel].zoom = Number(zoomInput.value) / 100;
  repaint();
});

// --- Photos: pick a panel, load a file, drag to reposition --------------------

const panelList = document.getElementById('panels');
function rebuildPanelList() {
  panelList.innerHTML = '';
  const count = PANEL_LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice';
    b.dataset.panel = String(i);
    b.textContent = `Panel ${i + 1}`;
    b.addEventListener('click', () => { selectedPanel = i; repaint(); });
    panelList.appendChild(b);
  }
}
rebuildPanelList();
document.getElementById('layouts').addEventListener('click', rebuildPanelList);

photoInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setPanelPhoto(selectedPanel, await loadImage(URL.createObjectURL(file)));
  status.textContent = `Photo loaded into panel ${selectedPanel + 1}.`;
});
document.getElementById('fillAll').addEventListener('click', async () => {
  const file = photoInput.files[0];
  if (!file) { status.textContent = 'Choose a photo first, then Fill all panels.'; return; }
  const img = await loadImage(URL.createObjectURL(file));
  const count = PANEL_LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) state.panels[i] = { photo: img, zoom: 1, ox: 0, oy: 0 };
  repaint();
  status.textContent = `One photo fills all ${count} panels.`;
});

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  // Topmost panel wins, so search from the last rect back.
  for (let i = lastRects.length - 1; i >= 0; i--) {
    const r = lastRects[i];
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      selectedPanel = i;
      dragging = { x: p.x, y: p.y, ox: state.panels[i].ox, oy: state.panels[i].oy, w: r.w, h: r.h };
      canvas.setPointerCapture(e.pointerId);
      repaint();
      return;
    }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPoint(e);
  const panel = state.panels[selectedPanel];
  panel.ox = dragging.ox + (p.x - dragging.x) / dragging.w;
  panel.oy = dragging.oy + (p.y - dragging.y) / dragging.h;
  repaint();
});
canvas.addEventListener('pointerup', () => { dragging = null; });

// --- Export ------------------------------------------------------------------

function downloadCanvas(out, size) {
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-cover-${size.w}x${size.h}.png`;
    a.click();
  }, 'image/png');
}

document.getElementById('export').addEventListener('click', () => {
  const size = POSTER_SIZES[state.size];
  downloadCanvas(exportPoster(state, state.size), size);
  status.textContent = `Saved neon-coast-cover-${size.w}x${size.h}.png`;
});
document.getElementById('exportAll').addEventListener('click', () => {
  for (const key of Object.keys(POSTER_SIZES)) {
    downloadCanvas(exportPoster(state, key), POSTER_SIZES[key]);
  }
  status.textContent = 'Saved all three sizes.';
});

// --- Boot: fonts first (canvas text needs them), then the samples -------------

const shot = new URLSearchParams(location.search).get('shot');
async function boot() {
  await document.fonts.ready;
  try {
    await Promise.all([
      document.fonts.load('64px Anton'),
      document.fonts.load('64px "Bebas Neue"'),
      document.fonts.load('32px Pacifico'),
    ]);
  } catch { /* fall back to system fonts if a font file cannot load */ }
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), state, setPanelPhoto, applySize, repaint);
  } else {
    // A sample photo in every panel, so the cover is alive on first open.
    const boulevard = await loadImage('samples/boulevard.jpg');
    const pier = await loadImage('samples/pier.jpg');
    setPanelPhoto(0, boulevard);
    setPanelPhoto(1, pier);
    setPanelPhoto(2, boulevard);
    setPanelPhoto(3, pier);
    selectedPanel = 0;
    applySize();
  }
  repaint();
}
boot();
