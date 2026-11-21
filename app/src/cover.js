// Neon Coast Cover Studio — the cover engine.
// Draws a multi-panel GTA-poster-style cover from the editor state onto a 2D canvas:
// panels of photos with a colour grade, inked borders, a bold lettered title block,
// a script subtitle, grain and a vignette. Everything is drawn from local files only
// and is fully deterministic (the grain uses a fixed-seed generator), so the same
// state always exports the same PNG bytes.

// Post sizes the app exports.
export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

// Layouts: each returns panel rects {x, y, w, h, rot} in canvas pixels, plus a title zone.
export const LAYOUTS = {
  grid: { label: 'Vice Grid', panels: 4, hint: 'Four equal panels' },
  hero: { label: 'Hero + Three', panels: 4, hint: 'One hero, three stacked' },
  bleed: { label: 'Full Bleed', panels: 1, hint: 'One photo, edge to edge' },
  strip: { label: 'Comic Strip', panels: 3, hint: 'Three tall panels' },
  tilted: { label: 'Tilted Snaps', panels: 3, hint: 'Overlapping tilted shots' },
  nine: { label: 'Nine Panel', panels: 9, hint: 'A 3 x 3 collage' },
};

// Colour grades: a wash over every photo plus the title gradient.
export const GRADES = {
  sunset: { label: 'Sunset', wash: ['rgba(255,122,26,0.28)', 'rgba(214,32,120,0.34)'], title: ['#fff7d6', '#ffb347'], accent: '#ff5e8a' },
  neon: { label: 'Neon Night', wash: ['rgba(255,45,149,0.30)', 'rgba(0,229,255,0.26)'], title: ['#ffffff', '#ff7ad9'], accent: '#00e5ff' },
  golden: { label: 'Golden Hour', wash: ['rgba(255,176,32,0.30)', 'rgba(255,94,0,0.22)'], title: ['#fffbe8', '#ffc93c'], accent: '#ff8c1a' },
  purple: { label: 'Vice Purple', wash: ['rgba(124,58,237,0.30)', 'rgba(236,72,153,0.30)'], title: ['#ffffff', '#c4b5fd'], accent: '#e879f9' },
  noir: { label: 'Noir', wash: ['rgba(20,20,30,0.10)', 'rgba(255,45,120,0.18)'], title: ['#ffffff', '#e5e5e5'], accent: '#ff2d78' },
};

const GUTTER = 10; // white gutter between panels, in export pixels (scaled by size)

/** Panel rectangles for a layout, in canvas pixels. */
export function layoutPanels(layout, w, h) {
  const g = Math.round(GUTTER * (w / 1080));
  const full = { x: 0, y: 0, w, h, rot: 0 };
  switch (layout) {
    case 'grid': {
      const cw = (w - g * 3) / 2, ch = (h - g * 3) / 2;
      return [
        { x: g, y: g, w: cw, h: ch, rot: 0 },
        { x: g * 2 + cw, y: g, w: cw, h: ch, rot: 0 },
        { x: g, y: g * 2 + ch, w: cw, h: ch, rot: 0 },
        { x: g * 2 + cw, y: g * 2 + ch, w: cw, h: ch, rot: 0 },
      ];
    }
    case 'hero': {
      const heroW = w * 0.62, sideW = w - heroW - g * 2;
      const sh = (h - g * 4) / 3;
      return [
        { x: g, y: g, w: heroW, h: h - g * 2, rot: 0 },
        { x: heroW + g * 2, y: g, w: sideW, h: sh, rot: 0 },
        { x: heroW + g * 2, y: g * 2 + sh, w: sideW, h: sh, rot: 0 },
        { x: heroW + g * 2, y: g * 3 + sh * 2, w: sideW, h: sh, rot: 0 },
      ];
    }
    case 'bleed':
      return [full];
    case 'strip': {
      const cw = (w - g * 4) / 3;
      return [0, 1, 2].map((i) => ({ x: g + i * (cw + g), y: g, w: cw, h: h - g * 2, rot: 0 }));
    }
    case 'tilted': {
      const pw = w * 0.56, ph = h * 0.62;
      return [
        { x: w * 0.05, y: h * 0.06, w: pw, h: ph, rot: -0.06 },
        { x: w * 0.42, y: h * 0.02, w: pw, h: ph, rot: 0.05 },
        { x: w * 0.24, y: h * 0.34, w: pw, h: ph, rot: -0.02 },
      ];
    }
    case 'nine': {
      const cw = (w - g * 4) / 3, ch = (h - g * 4) / 3;
      const rects = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
        rects.push({ x: g + c * (cw + g), y: g + r * (ch + g), w: cw, h: ch, rot: 0 });
      return rects;
    }
    default:
      return [full];
  }
}

/** A fixed-seed generator so grain is identical on every export. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws one photo into a panel rect, cover-fit, with the panel's zoom and pan. */
function drawPanelPhoto(ctx, photo, rect, panel, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (photo) {
    const base = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight);
    const scale = base * (panel.zoom || 1);
    const pw = photo.naturalWidth * scale;
    const ph = photo.naturalHeight * scale;
    const cx = rect.x + rect.w / 2 + (panel.ox || 0) * rect.w;
    const cy = rect.y + rect.h / 2 + (panel.oy || 0) * rect.h;
    if (grade === 'noir') ctx.filter = 'grayscale(1) contrast(1.08)';
    ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#241a2e';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  // Grade wash: a diagonal tint over the photo.
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  wash.addColorStop(0, GRADES[grade].wash[0]);
  wash.addColorStop(1, GRADES[grade].wash[1]);
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  // Inked black border around the panel, like poster art.
  ctx.save();
  ctx.lineWidth = Math.max(3, rect.w * 0.008);
  ctx.strokeStyle = '#12081c';
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** The title block: bold gradient lettering with a black outline, plus a script subtitle. */
function drawTitleBlock(ctx, w, h, state) {
  const grade = GRADES[state.grade];
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const bandH = h * (state.titlePos === 'top' ? 0.30 : 0.34);
  const bandY = state.titlePos === 'top' ? 0 : h - bandH;
  // Dark band the lettering sits on.
  const band = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  band.addColorStop(0, 'rgba(10,4,18,0)');
  band.addColorStop(0.35, 'rgba(10,4,18,0.82)');
  band.addColorStop(1, 'rgba(10,4,18,0.92)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, w, bandH);

  if (title) {
    const fontFamily = state.titleFont === 'bebas' ? '"Bebas Neue", "Anton", sans-serif' : '"Anton", sans-serif';
    let size = Math.min(h * 0.13, w * 0.16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const setFont = (s) => { ctx.font = `${s}px ${fontFamily}`; };
    setFont(size);
    while (ctx.measureText(title).width > w * 0.92 && size > 20) { size -= 4; setFont(size); }
    const ty = bandY + bandH * 0.48;
    // Gradient fill + black outline + shadow: the poster's bold lettering.
    const fill = ctx.createLinearGradient(0, ty - size * 0.6, 0, ty + size * 0.6);
    fill.addColorStop(0, grade.title[0]);
    fill.addColorStop(1, grade.title[1]);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.10);
    ctx.strokeStyle = '#12081c';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.04;
    ctx.strokeText(title, w / 2, ty);
    ctx.fillStyle = fill;
    ctx.fillText(title, w / 2, ty);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (subtitle) {
    const sy = bandY + bandH * 0.86;
    const subSize = Math.max(20, h * 0.045);
    ctx.font = `${subSize}px "Pacifico", cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grade.accent;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = subSize * 0.25;
    ctx.fillText(subtitle, w / 2, sy);
    ctx.shadowBlur = 0;
  }
}

/** Film grain: deterministic speckles over the whole cover. */
function drawGrain(ctx, w, h) {
  const rand = mulberry32(20261121);
  const step = Math.max(3, Math.round(w / 360));
  ctx.save();
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = rand();
      if (v > 0.88) {
        ctx.fillStyle = v > 0.94 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  ctx.restore();
}

/** A soft dark vignette around the edges. */
function drawVignette(ctx, w, h) {
  const r = Math.hypot(w, h) / 2;
  const v = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draws the whole cover from `state` onto `canvas` (the canvas keeps its own size).
 * state: { layout, grade, size, title, subtitle, titleFont, titlePos, frame, grain,
 *   vignette, panels: [{ photo, zoom, ox, oy }] }.
 * Returns the panel rects, so the editor can hit-test clicks.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  // Paper-white base: the gutters and frame read as poster board.
  ctx.fillStyle = state.frame === false ? '#12081c' : '#f5efe4';
  ctx.fillRect(0, 0, w, h);
  const rects = layoutPanels(state.layout, w, h);
  const count = LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) {
    const panel = state.panels[i] || {};
    const rect = rects[i];
    if (rect.rot) {
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      // Shadow under the tilted snapshot.
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = h * 0.012;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, -6, rect.w + 12, rect.h + 12);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      drawPanelPhoto(ctx, panel.photo, { x: 0, y: 0, w: rect.w, h: rect.h }, panel, state.grade);
      ctx.restore();
    } else {
      drawPanelPhoto(ctx, panel.photo, rect, panel, state.grade);
    }
  }
  drawTitleBlock(ctx, w, h, state);
  if (state.vignette !== false) drawVignette(ctx, w, h);
  if (state.grain !== false) drawGrain(ctx, w, h);
  return rects;
}

/** Renders `state` at an export size onto a fresh canvas and returns it. */
export function renderExport(state, sizeKey) {
  const size = SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  return canvas;
}
