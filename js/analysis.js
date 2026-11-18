// Phân tích chuỗi khung xương: làm mượt, tìm cú đánh, đo các tiêu chí, chấm điểm.
import { STROKES, gradeOf } from './criteria.js';

const VIS = 0.3;
const SIDE_IDX = {
  R: { sh: 12, el: 14, wr: 16, hip: 24, knee: 26, ank: 28, toe: 32 },
  L: { sh: 11, el: 13, wr: 15, hip: 23, knee: 25, ank: 27, toe: 31 },
};
const NOSE = 0;

// ---------- tiền xử lý ----------
export function preprocess(frames) {
  const n = frames.length;
  const out = frames.map(f => ({ t: f.t, kp: f.kp ? f.kp.map(p => ({ ...p })) : null }));
  // nội suy khoảng trống ngắn (≤ 4 khung)
  let i = 0;
  while (i < n) {
    if (out[i].kp) { i++; continue; }
    let j = i;
    while (j < n && !out[j].kp) j++;
    if (i > 0 && j < n && j - i <= 4) {
      const a = out[i - 1].kp, b = out[j].kp;
      for (let k = i; k < j; k++) {
        const r = (k - i + 1) / (j - i + 1);
        out[k].kp = a.map((p, m) => ({ x: p.x + (b[m].x - p.x) * r, y: p.y + (b[m].y - p.y) * r, v: Math.min(p.v, b[m].v) }));
      }
    }
    i = j;
  }
  // làm mượt trọng số 1-2-1
  return out.map((f, i) => {
    if (!f.kp) return f;
    const prev = out[i - 1]?.kp, next = out[i + 1]?.kp;
    return {
      t: f.t,
      kp: f.kp.map((p, m) => {
        let sx = 2 * p.x, sy = 2 * p.y, w = 2;
        if (prev) { sx += prev[m].x; sy += prev[m].y; w++; }
        if (next) { sx += next[m].x; sy += next[m].y; w++; }
        return { x: sx / w, y: sy / w, v: p.v };
      }),
    };
  });
}

// ---------- hình học ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => (a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null);
function angle(a, b, c) {
  if (!a || !b || !c) return null;
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (!d) return null;
  return Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180 / Math.PI;
}
// góc so với phương thẳng đứng của vector từ a (dưới) lên b (trên)
function tiltFromVertical(a, b) {
  if (!a || !b) return null;
  return Math.atan2(Math.abs(b.x - a.x), Math.abs(a.y - b.y)) * 180 / Math.PI;
}
const median = arr => { const s = arr.filter(v => v != null && isFinite(v)).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

function autoSide(frames) {
  const path = { L: 0, R: 0 };
  for (const s of ['L', 'R']) {
    const w = SIDE_IDX[s].wr;
    let prev = null;
    for (const f of frames) {
      const p = f.kp && f.kp[w].v >= VIS ? f.kp[w] : null;
      if (p && prev) path[s] += dist(p, prev);
      prev = p;
    }
  }
  return path.R >= path.L ? 'R' : 'L';
}

function makeCtx(frames, side) {
  const r = SIDE_IDX[side], o = SIDE_IDX[side === 'R' ? 'L' : 'R'];
  const P = (i, idx, minV = VIS) => {
    const kp = frames[i]?.kp;
    if (!kp) return null;
    const p = kp[idx];
    return p && p.v >= minV ? p : null;
  };
  const midSh = i => mid(P(i, 11, 0.05), P(i, 12, 0.05));
  const midHip = i => mid(P(i, 23, 0.05), P(i, 24, 0.05));
  const torsos = frames.map((_, i) => { const a = midSh(i), b = midHip(i); return a && b ? dist(a, b) : null; });
  const U = median(torsos);
  const t = frames.map(f => f.t);
  const n = frames.length;
  // tốc độ cổ tay vợt (T/giây)
  const speed = frames.map((_, i) => {
    if (!U || i === 0 || i === n - 1) return null;
    const a = P(i - 1, r.wr, 0.15), b = P(i + 1, r.wr, 0.15);
    if (!a || !b) return null;
    return dist(a, b) / (t[i + 1] - t[i - 1]) / U;
  });
  return { frames, side, r, o, P, midSh, midHip, U, t, n, speed };
}

// ---------- tìm sự kiện ----------
function pickPeaks(cands, minGap) {
  cands.sort((a, b) => b.w - a.w);
  const chosen = [];
  for (const c of cands) if (chosen.every(x => Math.abs(x.t - c.t) >= minGap)) chosen.push(c);
  return chosen.sort((a, b) => a.t - b.t);
}

function detectSwings(ctx, S) {
  const { speed, t, n } = ctx;
  const valid = speed.filter(v => v != null);
  if (!valid.length) return [];
  const max = Math.max(...valid);
  const thr = Math.max(S.minSpeed, 0.4 * max);
  const cands = [];
  for (let i = 1; i < n - 1; i++) {
    const v = speed[i];
    if (v == null || v < thr) continue;
    if (v >= (speed[i - 1] ?? 0) && v >= (speed[i + 1] ?? 0)) cands.push({ i, t: t[i], w: v });
  }
  let ev = pickPeaks(cands, S.minGap);
  if (!ev.length) {
    const i = speed.indexOf(max);
    ev = [{ i, t: t[i], w: max, weak: true }];
  }
  return ev;
}

function detectLunges(ctx, S) {
  const { P, r, t, n } = ctx;
  const knee = Array.from({ length: n }, (_, i) => angle(P(i, r.hip), P(i, r.knee), P(i, r.ank)));
  const cands = [];
  for (let i = 1; i < n - 1; i++) {
    const v = knee[i];
    if (v == null || v > S.maxKnee) continue;
    if (v <= (knee[i - 1] ?? 999) && v <= (knee[i + 1] ?? 999)) cands.push({ i, t: t[i], w: 180 - v });
  }
  let ev = pickPeaks(cands, S.minGap);
  if (!ev.length) {
    const vals = knee.filter(v => v != null);
    if (!vals.length) return [];
    const mn = Math.min(...vals), i = knee.indexOf(mn);
    ev = [{ i, t: t[i], w: 180 - mn, weak: true }];
  }
  return ev;
}

// ---------- số đo ----------
function idxRange(ctx, ev, [a, b]) {
  const out = [];
  for (let i = 0; i < ctx.n; i++) if (ctx.t[i] >= ev.t + a - 1e-6 && ctx.t[i] <= ev.t + b + 1e-6) out.push(i);
  return out;
}
function over(ctx, ev, win, fn, agg) {
  const vals = idxRange(ctx, ev, win).map(fn).filter(v => v != null && isFinite(v));
  if (!vals.length) return null;
  return agg === 'max' ? Math.max(...vals) : agg === 'min' ? Math.min(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length;
}
const at = (ctx, ev, fn) => over(ctx, ev, [-0.04, 0.04], fn, 'mean');

const M = {
  // ---- phông cầu ----
  c_offarm: (c, ev, S) => over(c, ev, S.prep, i => { const s = c.P(i, c.o.sh), w = c.P(i, c.o.wr); return s && w ? (s.y - w.y) / c.U : null; }, 'max'),
  c_elbow_up: (c, ev, S) => over(c, ev, S.prep, i => { const s = c.P(i, c.r.sh), e = c.P(i, c.r.el); return s && e ? (s.y - e.y) / c.U : null; }, 'max'),
  c_contact_high: (c, ev, S) => over(c, ev, S.contact, i => { const n = c.P(i, NOSE, 0.1), w = c.P(i, c.r.wr, 0.15); return n && w ? (n.y - w.y) / c.U : null; }, 'max'),
  c_extend: (c, ev, S) => over(c, ev, S.contact, i => angle(c.P(i, c.r.sh), c.P(i, c.r.el), c.P(i, c.r.wr, 0.15)), 'max'),
  c_rotation: (c, ev, S) => {
    const span = i => { const a = c.P(i, 11, 0.05), b = c.P(i, 12, 0.05); return a && b ? Math.abs(a.x - b.x) / c.U : null; };
    const hi = over(c, ev, [S.prep[0], 0.15], span, 'max'), lo = over(c, ev, [S.prep[0], 0.15], span, 'min');
    return hi != null && lo != null ? hi - lo : null;
  },
  c_follow: (c, ev, S) => over(c, ev, S.finish, i => { const s = c.P(i, c.r.sh), w = c.P(i, c.r.wr, 0.15); return s && w ? (s.y - w.y) / c.U : null; }, 'min'),
  c_knee: (c, ev, S) => over(c, ev, S.prep, i => angle(c.P(i, c.r.hip), c.P(i, c.r.knee), c.P(i, c.r.ank)), 'min'),

  // ---- bỏ nhỏ / kê lưới ----
  n_lunge: (c, ev) => at(c, ev, i => angle(c.P(i, c.r.hip), c.P(i, c.r.knee), c.P(i, c.r.ank))),
  n_back_leg: (c, ev) => at(c, ev, i => angle(c.P(i, c.o.hip), c.P(i, c.o.knee), c.P(i, c.o.ank))),
  n_shin: (c, ev) => at(c, ev, i => tiltFromVertical(c.P(i, c.r.ank), c.P(i, c.r.knee))),
  n_hand_high: (c, ev, S) => over(c, ev, S.contact, i => { const h = c.midHip(i), w = c.P(i, c.r.wr, 0.15); return h && w ? (h.y - w.y) / c.U : null; }, 'max'),
  n_arm_reach: (c, ev, S) => over(c, ev, S.contact, i => angle(c.P(i, c.r.sh), c.P(i, c.r.el), c.P(i, c.r.wr, 0.15)), 'max'),
  n_trunk: (c, ev) => at(c, ev, i => tiltFromVertical(c.midHip(i), c.midSh(i))),
  n_recover: (c, ev, S) => {
    const hipAt = win => { const pts = idxRange(c, ev, win).map(i => c.midHip(i)).filter(Boolean); return pts; };
    const start = hipAt([S.prep[0] - 0.1, S.prep[0] + 0.1])[0];
    const lungeP = hipAt([-0.04, 0.04])[0];
    const after = hipAt(S.finish);
    if (!start || !lungeP || after.length < 3) return null;
    const lungeD = dist(start, lungeP);
    if (lungeD < 0.3 * c.U) return null;
    const best = Math.min(...after.map(p => dist(p, start)));
    return Math.max(0, (lungeD - best) / lungeD);
  },

  // ---- tạt cầu ----
  d_stance: c => median(c.frames.map((_, i) => { const a = c.P(i, 27), b = c.P(i, 28); return a && b ? Math.abs(a.x - b.x) / c.U : null; })),
  d_knee: c => median(c.frames.map((_, i) => {
    const a = angle(c.P(i, 23), c.P(i, 25), c.P(i, 27)), b = angle(c.P(i, 24), c.P(i, 26), c.P(i, 28));
    return a != null && b != null ? (a + b) / 2 : a ?? b;
  })),
  d_ready: (c, ev, S) => over(c, ev, S.prep, i => { const h = c.midHip(i), w = c.P(i, c.r.wr, 0.15); return h && w ? (h.y - w.y) / c.U : null; }, 'max'),
  d_contact: (c, ev, S) => over(c, ev, S.contact, i => { const s = c.P(i, c.r.sh), w = c.P(i, c.r.wr, 0.15); return s && w ? (s.y - w.y) / c.U : null; }, 'mean'),
  d_elbow: (c, ev, S) => over(c, ev, S.contact, i => { const s = c.P(i, c.r.sh), e = c.P(i, c.r.el); return s && e ? (s.y - e.y) / c.U : null; }, 'max'),
  d_compact: (c, ev) => {
    const ids = idxRange(c, ev, [-0.25, 0.25]);
    let len = 0, prev = null, cnt = 0;
    for (const i of ids) { const p = c.P(i, c.r.wr, 0.15); if (p && prev) { len += dist(p, prev); cnt++; } prev = p; }
    return cnt >= ids.length * 0.6 ? len / c.U : null;
  },
  d_recover: (c, ev) => {
    const peak = c.speed[ev.i];
    if (!peak) return null;
    for (let i = ev.i + 1; i < c.n; i++) {
      if (c.t[i] - ev.t > 0.8) return null;
      if (c.speed[i] != null && c.speed[i] < 0.3 * peak) return c.t[i] - ev.t;
    }
    return null;
  },
  d_balance: (c, ev) => over(c, ev, [-0.3, 0.3], i => tiltFromVertical(c.midHip(i), c.midSh(i)), 'max'),
};

// ---------- đánh giá tổng ----------
export function evaluate(rawFrames, { stroke, view, hand }) {
  const S = STROKES[stroke];
  const frames = preprocess(rawFrames);
  const detected = frames.filter(f => f.kp).length;
  if (detected < Math.max(5, frames.length * 0.3)) {
    return { error: 'Không nhận diện được người chơi đủ rõ trong video. Hãy thử quay gần hơn, đủ sáng, hoặc khoanh vùng lại người chơi.', frames };
  }
  const sideAuto = hand === 'auto';
  const side = sideAuto ? autoSide(frames) : hand;
  const ctx = makeCtx(frames, side);
  if (!ctx.U) return { error: 'Không xác định được vai và hông của người chơi.', frames };

  const events = S.event === 'lunge' ? detectLunges(ctx, S) : detectSwings(ctx, S);
  const swings = events.map(ev => {
    const results = S.criteria.map(c => {
      if (!c.views.includes(view)) return { id: c.id, value: null, status: 'na', score: null, reason: 'view' };
      let v = null;
      try { v = M[c.id](ctx, ev, S); } catch (e) { console.warn(c.id, e); }
      const g = gradeOf(c, v);
      return { id: c.id, value: v, ...g, reason: v == null ? 'missing' : null };
    });
    return { t: ev.t, i: ev.i, weak: !!ev.weak, results, score: weighted(S, results) };
  });

  // tổng hợp theo tiêu chí (trung bình các cú)
  const summary = S.criteria.map(c => {
    const rs = swings.map(s => s.results.find(r => r.id === c.id)).filter(r => r && r.value != null);
    if (!rs.length) {
      const any = swings[0]?.results.find(r => r.id === c.id);
      return { id: c.id, value: null, status: 'na', score: null, reason: any?.reason || 'missing' };
    }
    // điểm = trung bình điểm từng lần; giá trị hiển thị = trung vị
    const score = Math.round(rs.reduce((a, r) => a + r.score, 0) / rs.length);
    const status = score >= 80 ? 'good' : score >= 50 ? 'ok' : 'bad';
    return { id: c.id, value: median(rs.map(r => r.value)), status, score, n: rs.length, nGood: rs.filter(r => r.status === 'good').length };
  });
  const sc = swings.map(s => s.score).filter(v => v != null);
  const score = sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null;

  // chất lượng dữ liệu
  const heights = frames.map(f => {
    if (!f.kp) return null;
    const ys = [0, 27, 28].map(k => f.kp[k]).filter(p => p.v > 0.2).map(p => p.y);
    return ys.length >= 2 ? Math.max(...ys) - Math.min(...ys) : null;
  });
  const personPx = median(heights);
  const vis = median(frames.filter(f => f.kp).map(f => f.kp.reduce((a, p) => a + p.v, 0) / f.kp.length));
  const warnings = [];
  if (personPx && personPx < 250) warnings.push(`Người chơi trong video khá nhỏ (cao ~${Math.round(personPx)} điểm ảnh). Kết quả có thể kém chính xác — hãy quay gần hơn để người chơi chiếm ≥ 1/2 chiều cao khung hình.`);
  if (detected < frames.length * 0.8) warnings.push(`Chỉ nhận diện được người chơi ở ${Math.round(100 * detected / frames.length)}% số khung hình.`);
  if (vis != null && vis < 0.6) warnings.push('Nhiều khớp bị che khuất hoặc mờ — thử quay ở nơi sáng hơn, tránh bị người khác che.');
  if (swings.some(s => s.weak)) warnings.push(S.event === 'lunge' ? 'Không thấy bước lunge rõ ràng — đã lấy thời điểm gối gập nhiều nhất.' : 'Không thấy cú vung rõ ràng — đã lấy thời điểm cổ tay nhanh nhất.');
  if (!S.criteria.some(c => c.views.includes(view)) || summary.filter(s => s.reason === 'view').length >= S.criteria.length / 2)
    warnings.push(`Góc quay này chỉ đo được một phần tiêu chí. Góc khuyên dùng cho ${S.name}: ${S.defaultView === 'side' ? 'ngang (bên hông)' : 'trước mặt hoặc sau lưng'}.`);

  return { side, sideAuto, U: ctx.U, swings, summary, score, quality: { personPx, vis, detected, total: frames.length }, warnings, frames };
}

function weighted(S, results) {
  let sw = 0, ss = 0;
  for (const r of results) {
    if (r.score == null) continue;
    const w = S.criteria.find(c => c.id === r.id).weight;
    sw += w; ss += w * r.score;
  }
  return sw ? Math.round(ss / sw) : null;
}

// thời điểm ảnh minh hoạ của một cú
export function keyTimes(stroke, sw, t0, t1) {
  const k = STROKES[stroke].keyOffsets;
  const cl = x => Math.min(t1, Math.max(t0, x));
  return [['Chuẩn bị', cl(sw.t + k.prep)], ['Chạm cầu', cl(sw.t + k.contact)], ['Kết thúc', cl(sw.t + k.finish)]];
}
