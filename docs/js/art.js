/* =====================================================================
   art.js — draws the pictures with <canvas> (no image files needed)
     drawCardArt(canvas, color, pattern) -> the pattern on each game card
     drawHero(t) + startHero()           -> the animated background on Home
   ===================================================================== */

/** The 4 pattern names a game can use (must match the database CHECK rule). */
const PATTERNS = ['rings', 'mountains', 'shards', 'grid'];

/**
 * drawCardArt(canvas, color, pattern)
 * Paints a gradient from the card color to dark, then one of 4 patterns:
 *   rings     = circles (Warframe)
 *   mountains = layered hills (Black Desert)
 *   shards    = triangles (Valorant)
 *   grid      = grid + crosshair (CS2)
 */
function drawCardArt(canvas, color, pattern) {
  const w = canvas.width = 460;   // drawing size; CSS stretches it to fit the card
  const h = canvas.height = 300;
  const ctx = canvas.getContext('2d');

  // Background gradient: card color (top-left) -> page background (bottom-right)
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#0f1116');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Pattern style: thin, see-through white lines and fills
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 2;

  if (pattern === 'rings') {
    // Circles growing out from one point
    for (let r = 30; r < 300; r += 28) {
      ctx.beginPath();
      ctx.arc(w * .72, h * .45, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (pattern === 'mountains') {
    // 3 wavy hill layers using sine/cosine curves
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) {
        const y = h * (.45 + k * .15) - Math.sin(x / (50 + k * 20) + k) * 30 - Math.cos(x / 23) * 10;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
  } else if (pattern === 'shards') {
    // 9 triangles in a loose cluster
    for (let s = 0; s < 9; s++) {
      const cx = w * .5 + s * 30 - 80;
      const cy = h * .2 + (s % 3) * 50;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 60, cy + 20);
      ctx.lineTo(cx + 20, cy + 90);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else { // 'grid'
    // Grid lines every 32px...
    for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // ...plus a brighter crosshair
    const cx = w * .7, cy = h * .5;
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.moveTo(cx - 50, cy); ctx.lineTo(cx + 50, cy);
    ctx.moveTo(cx, cy - 50); ctx.lineTo(cx, cy + 50);
    ctx.stroke();
  }
}

/** true when the visitor asked their system for less motion (accessibility). */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Glowing "embers" that float up through the hero. Each one has a random
   start position, speed, size and color, made once when the page loads. */
const EMBERS = Array.from({ length: 34 }, () => ({
  x: Math.random(),                 // 0..1 = left..right (scaled to the canvas width)
  y: Math.random(),                 // 0..1 = top..bottom
  r: 0.8 + Math.random() * 2.2,     // radius in px
  speed: 0.015 + Math.random() * 0.04, // how fast it rises (canvas heights per second)
  sway: Math.random() * Math.PI * 2,   // where it starts in its side-to-side wobble
  teal: Math.random() < 0.3         // 30% teal, 70% orange
}));

/**
 * drawHero(t)
 * Draws the Home background: moving diagonal orange stripes, a slowly
 * drifting teal glow, rising embers, then a dark fade on the left so the
 * big "proxyz" title stays readable.
 * t = time in seconds (0 = a still picture, used when motion is reduced).
 */
function drawHero(t = 0) {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !canvas.offsetWidth) return false; // Home is hidden: nothing to draw

  // Only resize the canvas when the window size really changed (resizing clears it)
  if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Diagonal stripes, sliding to the right (the % 26 makes the loop seamless)
  const shift = (t * 14) % 26;
  ctx.strokeStyle = 'rgba(255,122,61,.18)';
  ctx.lineWidth = 1;
  for (let i = -h - 26 + shift; i < w; i += 26) {
    ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0); ctx.stroke();
  }

  // Teal glow in the top-right that drifts in a slow circle
  const gx = w * (.8 + Math.sin(t * .35) * .06);
  const gy = h * (.3 + Math.cos(t * .28) * .12);
  const glow = ctx.createRadialGradient(gx, gy, 10, gx, gy, w * .5);
  glow.addColorStop(0, 'rgba(63,193,201,.28)');
  glow.addColorStop(1, 'rgba(15,17,22,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Embers: rise upward, wobble sideways, wrap back to the bottom
  EMBERS.forEach(e => {
    const y = ((e.y - t * e.speed) % 1 + 1) % 1;           // 0..1, loops forever
    const x = e.x + Math.sin(t * .8 + e.sway) * .015;
    const alpha = Math.min(1, y * 3) * .75;                 // fade out near the top
    ctx.beginPath();
    ctx.arc(x * w, y * h, e.r, 0, Math.PI * 2);
    ctx.fillStyle = e.teal ? `rgba(63,193,201,${alpha})` : `rgba(255,140,80,${alpha})`;
    ctx.shadowColor = e.teal ? '#3fc1c9' : '#ff7a3d';
    ctx.shadowBlur = 8;
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  // Dark fade on the left so the title is easy to read
  const fade = ctx.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, 'rgba(15,17,22,1)');
  fade.addColorStop(.6, 'rgba(15,17,22,.6)');
  fade.addColorStop(1, 'rgba(15,17,22,.2)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);
  return true;
}

/* ---------- Hero animation loop ----------
   requestAnimationFrame calls `frame` about 60 times a second while the
   tab is visible (browsers pause it in background tabs, saving battery).
   The loop stops by itself when Home is hidden; showView() starts it again. */
let heroLoopId = null;

function startHero() {
  if (REDUCED_MOTION) { drawHero(0); return; }    // one still picture, no motion
  if (heroLoopId) return;                          // already running
  const start = performance.now();
  const frame = now => {
    if (!drawHero((now - start) / 1000)) { heroLoopId = null; return; } // Home hidden -> stop
    heroLoopId = requestAnimationFrame(frame);
  };
  heroLoopId = requestAnimationFrame(frame);
}

// Redraw at the new size when the window changes (the loop keeps going by itself)
window.addEventListener('resize', () => { if (REDUCED_MOTION) drawHero(0); });
