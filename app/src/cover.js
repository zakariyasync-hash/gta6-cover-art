// Neon Coast Cover Studio — poster engine, written fresh in this session.
// Turns editor state into a multi-panel GTA-poster-style cover on a 2D canvas:
// photos in panels with a sunset/neon grade, inked panel borders, a bold
// gradient title with a script subtitle, deterministic speckle and a vignette.
// Nothing here loads over the network; every asset lives under app/.

export const POSTER_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

export const PANEL_LAYOUTS = {
  grid: { label: 'Vice Grid', panels: 4, hint: 'Four equal panels' },
  hero: { label: 'Hero + Three', panels: 4, hint: 'One hero, three stacked' },
  bleed: { label: 'Full Bleed', panels: 1, hint: 'One photo, edge to edge' },
  strip: { label: 'Comic Strip', panels: 3, hint: 'Three tall panels' },
  tilted: { label: 'Tilted Snaps', panels: 3, hint: 'Overlapping tilted shots' },
  nine: { label: 'Nine Panel', panels: 9, hint: 'A 3 x 3 collage' },
};

export const COLOUR_GRADES = {
  sunset: { label: 'Sunset', wash: ['rgba(255,122,26,0.30)', 'rgba(214,32,120,0.34)'], title: ['#fff7d6', '#ffb347'], accent: '#ff5e8a' },
  neon: { label: 'Neon Night', wash: ['rgba(255,45,149,0.32)', 'rgba(0,229,255,0.28)'], title: ['#ffffff', '#ff7ad9'], accent: '#00e5ff' },
  golden: { label: 'Golden Hour', wash: ['rgba(255,176,32,0.32)', 'rgba(255,94,0,0.24)'], title: ['#fffbe8', '#ffc93c'], accent: '#ff8c1a' },
  purple: { label: 'Vice Purple', wash: ['rgba(124,58,237,0.32)', 'rgba(236,72,153,0.32)'], title: ['#ffffff', '#c4b5fd'], accent: '#e879f9' },
  noir: { label: 'Noir', wash: ['rgba(10,10,18,0.12)', 'rgba(255,45,120,0.20)'], title: ['#ffffff', '#e5e5e5'], accent: '#ff2d78' },
};

// A tiny xorshift generator: the speckle is identical on every export.
function xorshift32(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Panel rectangles for one layout, in canvas pixels.
 * `m` is the outer margin, `g` the gutter; both scale with the cover width.
 */
export function panelRects(layout, w, h) {
  const m = Math.round(14 * (w / 1080));
  const g = Math.round(12 * (w / 1080));
  const whole = [{ x: 0, y: 0, w, h, rot: 0 }];
  if (layout === 'grid') {
    const cw = (w - m * 2 - g) / 2, ch = (h - m * 2 - g) / 2;
    return [
      { x: m, y: m, w: cw, h: ch, rot: 0 },
      { x: m + cw + g, y: m, w: cw, h: ch, rot: 0 },
      { x: m, y: m + ch + g, w: cw, h: ch, rot: 0 },
      { x: m + cw + g, y: m + ch + g, w: cw, h: ch, rot: 0 },
    ];
  }
  if (layout === 'hero') {
    const heroW = w * 0.60, sideW = w - heroW - m * 2 - g;
    const sh = (h - m * 2 - g * 2) / 3;
    return [
      { x: m, y: m, w: heroW, h: h - m * 2, rot: 0 },
      { x: m + heroW + g, y: m, w: sideW, h: sh, rot: 0 },
      { x: m + heroW + g, y: m + sh + g, w: sideW, h: sh, rot: 0 },
      { x: m + heroW + g, y: m + sh * 2 + g * 2, w: sideW, h: sh, rot: 0 },
    ];
  }
  if (layout === 'strip') {
    const cw = (w - m * 2 - g * 2) / 3;
    return [0, 1, 2].map((i) => ({ x: m + i * (cw + g), y: m, w: cw, h: h - m * 2, rot: 0 }));
  }
  if (layout === 'tilted') {
    const pw = w * 0.54, ph = h * 0.60;
    return [
      { x: w * 0.06, y: h * 0.07, w: pw, h: ph, rot: -0.055 },
      { x: w * 0.42, y: h * 0.03, w: pw, h: ph, rot: 0.05 },
      { x: w * 0.24, y: h * 0.35, w: pw, h: ph, rot: -0.02 },
    ];
  }
  if (layout === 'nine') {
    const cw = (w - m * 2 - g * 2) / 3, ch = (h - m * 2 - g * 2) / 3;
    const out = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      out.push({ x: m + c * (cw + g), y: m + r * (ch + g), w: cw, h: ch, rot: 0 });
    }
    return out;
  }
  return whole;
}

/** One photo, cover-fit into its panel, with zoom/pan and the grade wash. */
function paintPhoto(ctx, img, rect, panel, gradeKey) {
  const grade = COLOUR_GRADES[gradeKey];
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (img) {
    const fit = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const scale = fit * (panel.zoom || 1);
    const pw = img.naturalWidth * scale, ph = img.naturalHeight * scale;
    const cx = rect.x + rect.w / 2 + (panel.ox || 0) * rect.w;
    const cy = rect.y + rect.h / 2 + (panel.oy || 0) * rect.h;
    if (gradeKey === 'noir') ctx.filter = 'grayscale(1) contrast(1.08)';
    ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#241a2e';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  ctx.save();
  ctx.lineWidth = Math.max(3, rect.w * 0.008);
  ctx.strokeStyle = '#12081c';
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Bold gradient title, script subtitle and a three-star mark on a dark band. */
function paintCaption(ctx, w, h, state) {
  const grade = COLOUR_GRADES[state.grade];
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const bandH = h * (state.titlePos === 'top' ? 0.28 : 0.32);
  const bandY = state.titlePos === 'top' ? 0 : h - bandH;
  const band = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  band.addColorStop(0, 'rgba(10,4,18,0)');
  band.addColorStop(0.35, 'rgba(10,4,18,0.82)');
  band.addColorStop(1, 'rgba(10,4,18,0.94)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, w, bandH);
  // Thin accent rule above the lettering.
  ctx.fillStyle = grade.accent;
  ctx.fillRect(w * 0.08, bandY + bandH * 0.14, w * 0.84, Math.max(3, h * 0.004));

  if (title) {
    const family = state.titleFont === 'bebas' ? '"Bebas Neue", "Anton", sans-serif' : '"Anton", sans-serif';
    let size = Math.min(h * 0.125, w * 0.155);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${size}px ${family}`;
    while (ctx.measureText(title).width > w * 0.9 && size > 20) {
      size -= 4;
      ctx.font = `${size}px ${family}`;
    }
    const ty = bandY + bandH * 0.52;
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
    const subSize = Math.max(20, h * 0.042);
    ctx.font = `${subSize}px "Pacifico", cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grade.accent;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = subSize * 0.25;
    ctx.fillText(subtitle, w / 2, bandY + bandH * 0.85);
    ctx.shadowBlur = 0;
  }
  // Three small stars above the title: the poster's rating mark.
  const starSize = Math.max(12, h * 0.018);
  ctx.font = `${starSize}px sans-serif`;
  ctx.fillStyle = grade.accent;
  ctx.textAlign = 'center';
  ctx.fillText('★ ★ ★', w / 2, bandY + bandH * 0.24);
}

/** Deterministic film speckle over the whole cover. */
function paintSpeckle(ctx, w, h) {
  const next = xorshift32(20261121);
  const step = Math.max(3, Math.round(w / 360));
  ctx.save();
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = next();
      if (v > 0.88) {
        ctx.fillStyle = v > 0.94 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  ctx.restore();
}

/** A soft dark vignette around the edges. */
function paintShade(ctx, w, h) {
  const r = Math.hypot(w, h) / 2;
  const v = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draws the whole cover from `state` onto `canvas` (the canvas keeps its size).
 * state: { layout, grade, size, title, subtitle, titleFont, titlePos, frame,
 *   grain, vignette, panels: [{ photo, zoom, ox, oy }] }.
 * Returns the panel rects, so the editor can hit-test clicks.
 */
export function renderPoster(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = state.frame === false ? '#12081c' : '#f5efe4';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  const count = PANEL_LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) {
    const panel = state.panels[i] || {};
    const rect = rects[i];
    if (rect.rot) {
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = h * 0.012;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-7, -7, rect.w + 14, rect.h + 14);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      paintPhoto(ctx, panel.photo, { x: 0, y: 0, w: rect.w, h: rect.h }, panel, state.grade);
      ctx.restore();
    } else {
      paintPhoto(ctx, panel.photo, rect, panel, state.grade);
    }
  }
  paintCaption(ctx, w, h, state);
  if (state.vignette !== false) paintShade(ctx, w, h);
  if (state.grain !== false) paintSpeckle(ctx, w, h);
  return rects;
}

/** Renders `state` at an export size onto a fresh canvas and returns it. */
export function exportPoster(state, sizeKey) {
  const size = POSTER_SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  renderPoster(canvas, state);
  return canvas;
}
