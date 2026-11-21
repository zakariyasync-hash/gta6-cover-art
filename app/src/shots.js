// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows one exported cover alone, drawn by the app at its
// export size. The query picks the scene: layout, grade, size, photo, caption,
// subtitle. window.__shotReady is set once the scene is painted.
import { PANEL_LAYOUTS, COLOUR_GRADES, POSTER_SIZES } from './cover.js';

export async function runShot(shot, query, state, setPanelPhoto, applySize, repaint) {
  const layout = query.get('layout') || 'hero';
  const grade = query.get('grade') || 'sunset';
  const sizeKey = query.get('size') || 'wide';
  if (PANEL_LAYOUTS[layout]) state.layout = layout;
  if (COLOUR_GRADES[grade]) state.grade = grade;
  if (POSTER_SIZES[sizeKey]) state.size = sizeKey;
  state.title = query.get('caption') || 'Neon Coast';
  state.subtitle = query.get('subtitle') || 'sunset run';
  if (query.get('font')) state.titleFont = query.get('font');
  if (query.get('titlePos')) state.titlePos = query.get('titlePos');
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;

  // Load the sample photos (made for make.fun with an image model, free to use).
  const load = async (name) => {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = `samples/${name}.jpg`; });
    return img;
  };
  const boulevard = await load('boulevard');
  const pier = await load('pier');
  const photos = [boulevard, pier, boulevard, pier, boulevard, pier, boulevard, pier, boulevard];
  const count = PANEL_LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) setPanelPhoto(i, photos[i]);

  if (shot === 'cover') document.body.classList.add('shot-cover');
  applySize();
  repaint();
  // Two frames so the canvas paint lands before the screenshot.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}
