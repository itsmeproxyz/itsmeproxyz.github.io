/* =====================================================================
   art.js — draws the pictures with <canvas> (no image files needed)
     drawCardArt(canvas, color, pattern) -> the pattern on each game card
     drawHero()                          -> the striped background on Home
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

/**
 * drawHero()
 * Draws diagonal orange stripes + a teal glow behind the big "proxyz"
 * title on Home, then fades the left side so the text stays readable.
 * Called on page load, when Home opens, and when the window resizes.
 */
function drawHero() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !canvas.offsetWidth) return; // Home is hidden: nothing to draw
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Diagonal stripes
  ctx.strokeStyle = 'rgba(255,122,61,.18)';
  ctx.lineWidth = 1;
  for (let i = -h; i < w; i += 26) {
    ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0); ctx.stroke();
  }

  // Teal glow in the top-right
  const glow = ctx.createRadialGradient(w * .8, h * .3, 10, w * .8, h * .3, w * .5);
  glow.addColorStop(0, 'rgba(63,193,201,.25)');
  glow.addColorStop(1, 'rgba(15,17,22,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Dark fade on the left so the title is easy to read
  const fade = ctx.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, 'rgba(15,17,22,1)');
  fade.addColorStop(.6, 'rgba(15,17,22,.6)');
  fade.addColorStop(1, 'rgba(15,17,22,.2)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);
}

// Redraw the hero when the window size changes
window.addEventListener('resize', drawHero);
