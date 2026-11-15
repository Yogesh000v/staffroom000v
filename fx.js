/* ============================================================
   fx.js – background effects (drawn on the <canvas id="fx">)
   1) Small red dots that wander on their own. Each dot is alone:
      no lines between dots and no mouse reaction.
   2) A thin red line (no glow) that follows the mouse (or finger) and fades away.
   The canvas sits ABOVE the page (but ignores clicks), so dots are
   visible everywhere and never hide behind cards or tables.
   ============================================================ */
'use strict';
(function () {
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches; // user wants less motion

  // ---- Settings (change these to tune the look) ----
  const DOT_RGB = '255,45,74';  // dot colour (red)
  const TRAIL_MS = 700;         // how long the cursor line stays visible
  const MAX_TRAIL = 80;         // max points kept in the line

  let W, H, dots = [];
  const trail = [];             // recent mouse points: { x, y, t }

  // Make one dot with a random position, size and direction
  function makeDot() {
    const angle = Math.random() * Math.PI * 2, speed = 0.15 + Math.random() * 0.55;
    return { x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 1.8,
             vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
             twinkle: Math.random() * 6.28, twinkleSpeed: 0.01 + Math.random() * 0.03 };
  }

  // Fit the canvas to the screen (sharp on phones too)
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(110, Math.max(35, W * H / 14000))); // fewer dots on small screens
    while (dots.length < count) dots.push(makeDot());
    dots.length = count;
  }

  // Move + draw one dot
  function drawDot(d) {
    if (!calm) {
      const turn = (Math.random() - 0.5) * 0.08;               // tiny random turn = wandering
      const c = Math.cos(turn), s = Math.sin(turn);
      [d.vx, d.vy] = [d.vx * c - d.vy * s, d.vx * s + d.vy * c];
      d.x += d.vx; d.y += d.vy; d.twinkle += d.twinkleSpeed;
    }
    if (d.x < -5) d.x = W + 5; if (d.x > W + 5) d.x = -5;       // leave one side, come back from the other
    if (d.y < -5) d.y = H + 5; if (d.y > H + 5) d.y = -5;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, 6.283);
    ctx.fillStyle = `rgba(${DOT_RGB},${0.5 + 0.4 * Math.sin(d.twinkle)})`;
    ctx.fill();
  }

  // Draw the cursor line: thin red line, newest part is solid, oldest part fades away
  function drawTrail(now) {
    while (trail.length && now - trail[0].t > TRAIL_MS) trail.shift();
    ctx.lineCap = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i], life = 1 - (now - b.t) / TRAIL_MS; // 1 = new, 0 = old
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 0.4 + 0.7 * life;                      // very thin line (about 1px at the cursor)
      ctx.strokeStyle = `rgba(${DOT_RGB},${0.9 * life})`;    // plain red, fades out. No glow.
      ctx.stroke();
    }
  }

  // Runs ~60 times a second
  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.shadowColor = `rgba(${DOT_RGB},.9)`; ctx.shadowBlur = 6;  // soft red glow on dots
    dots.forEach(drawDot);
    ctx.shadowBlur = 0;
    drawTrail(now);
    requestAnimationFrame(frame);
  }

  // Remember where the pointer goes (mouse and touch)
  addEventListener('pointermove', e => {
    if (calm) return;
    trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (trail.length > MAX_TRAIL) trail.shift();
  }, { passive: true });
  addEventListener('resize', resize);

  resize();
  requestAnimationFrame(frame);
})();
