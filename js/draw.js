// Vẽ khung xương.
const BONES = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [15, 19], [12, 14], [14, 16], [16, 20],
  [23, 25], [25, 27], [27, 31], [27, 29], [24, 26], [26, 28], [28, 32], [28, 30],
];
const RACKET_ARM = { R: new Set([12, 14, 16, 20]), L: new Set([11, 13, 15, 19]) };

// kp: mảng 33 điểm {x,y,v}; map: hàm chuyển toạ độ -> canvas
export function drawSkeleton(ctx, kp, map, { side = 'R', scale = 1, minV = 0.2 } = {}) {
  if (!kp) return;
  const arm = RACKET_ARM[side] || RACKET_ARM.R;
  ctx.save();
  ctx.lineCap = 'round';
  for (const [a, b] of BONES) {
    const p = kp[a], q = kp[b];
    if (!p || !q || p.v < minV || q.v < minV) continue;
    const P = map(p), Q = map(q);
    const hot = arm.has(a) && arm.has(b);
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.lineWidth = (hot ? 6 : 4.5) * scale;
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(Q.x, Q.y); ctx.stroke();
    ctx.strokeStyle = hot ? '#ffcc00' : '#3ee08f';
    ctx.lineWidth = (hot ? 3.5 : 2.5) * scale;
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(Q.x, Q.y); ctx.stroke();
  }
  for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const p = kp[i];
    if (!p || p.v < minV) continue;
    const P = map(p);
    ctx.fillStyle = arm.has(i) ? '#ffcc00' : '#ffffff';
    ctx.beginPath(); ctx.arc(P.x, P.y, 3 * scale, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Vùng hiển thị thực của video trong phần tử (object-fit: contain)
export function contentRect(el, W, H) {
  const cw = el.clientWidth, ch = el.clientHeight;
  const s = Math.min(cw / W, ch / H);
  return { s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, cw, ch };
}

export function fitCanvas(canvas, w, h) {
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
