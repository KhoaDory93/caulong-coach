// Nhận diện khung xương bằng MediaPipe Pose Landmarker (chạy trên máy, không gửi video đi đâu).
import { FilesetResolver, PoseLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

let lm = null, loading = null, mode = null, numPoses = null, lastTs = 0, cancelFlag = false;

export async function loadModel() {
  if (lm) return lm;
  if (loading) return loading;
  loading = (async () => {
    const fs = await FilesetResolver.forVisionTasks(WASM);
    const opts = delegate => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'IMAGE', numPoses: 4,
      minPoseDetectionConfidence: 0.3, minPosePresenceConfidence: 0.3, minTrackingConfidence: 0.3,
    });
    try { lm = await PoseLandmarker.createFromOptions(fs, opts('GPU')); }
    catch (e) { console.warn('GPU không khả dụng, dùng CPU', e); lm = await PoseLandmarker.createFromOptions(fs, opts('CPU')); }
    mode = 'IMAGE'; numPoses = 4;
    return lm;
  })();
  try { return await loading; } finally { loading = null; }
}

async function setMode(m, n) {
  if (mode !== m || numPoses !== n) { await lm.setOptions({ runningMode: m, numPoses: n }); mode = m; numPoses = n; }
}

export function seek(v, t) {
  return new Promise(res => {
    const done = () => { v.removeEventListener('seeked', done); clearTimeout(to); res(); };
    const to = setTimeout(done, 3000);
    v.addEventListener('seeked', done);
    v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.001));
  });
}

// Vẽ một vùng hình vuông của video (có thể tràn ra ngoài khung) vào canvas.
export function drawCrop(v, box, canvas) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sx = Math.max(0, box.x), sy = Math.max(0, box.y);
  const ex = Math.min(v.videoWidth, box.x + box.w), ey = Math.min(v.videoHeight, box.y + box.h);
  if (ex <= sx || ey <= sy) return;
  const kx = canvas.width / box.w, ky = canvas.height / box.h;
  ctx.drawImage(v, sx, sy, ex - sx, ey - sy, (sx - box.x) * kx, (sy - box.y) * ky, (ex - sx) * kx, (ey - sy) * ky);
}

function bboxOf(kp, minV = 0.3) {
  const pts = kp.filter(p => p.v >= minV);
  if (pts.length < 6) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const iou = (a, b) => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  return { iou: inter / (a.w * a.h + b.w * b.h - inter), cover: inter / Math.min(a.w * a.h, b.w * b.h) };
};

// Tìm mọi người trong khung hình: chạy trên cả khung + các ô nhỏ chồng lấn (để bắt người ở xa).
export async function findPeople(v, t) {
  await loadModel();
  await setMode('IMAGE', 4);
  await seek(v, t);
  const W = v.videoWidth, H = v.videoHeight;
  const found = [];
  const run = (canvas, box) => {
    const r = lm.detect(canvas);
    for (const l of r.landmarks || []) {
      const inside = l.filter(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1).length / l.length;
      const kp = l.map(p => ({ x: box.x + p.x * box.w, y: box.y + p.y * box.h, v: p.visibility ?? 1 }));
      const bb = bboxOf(kp);
      if (!bb || bb.h < 24) continue;
      const score = kp.reduce((a, p) => a + p.v, 0) / kp.length;
      if (score < 0.45) continue;
      found.push({ box: bb, kp, score: score * (0.5 + 0.5 * inside) });
    }
  };
  // toàn khung
  const full = document.createElement('canvas');
  const k = Math.min(1, 640 / Math.max(W, H));
  full.width = Math.round(W * k); full.height = Math.round(H * k);
  full.getContext('2d').drawImage(v, 0, 0, full.width, full.height);
  run(full, { x: 0, y: 0, w: W, h: H });
  // các ô vuông chồng lấn 50%
  const S = Math.round(Math.min(W, H) * 0.55), step = Math.round(S / 2);
  const pos = len => { const a = []; for (let p = 0; p + S < len; p += step) a.push(p); a.push(Math.max(0, len - S)); return [...new Set(a)]; };
  const tile = document.createElement('canvas'); tile.width = tile.height = 384;
  for (const y of pos(H)) for (const x of pos(W)) {
    const box = { x, y, w: S, h: S };
    drawCrop(v, box, tile);
    run(tile, box);
  }
  // gộp các phát hiện trùng nhau
  found.sort((a, b) => b.score * Math.sqrt(b.box.w * b.box.h) - a.score * Math.sqrt(a.box.w * a.box.h));
  const people = [];
  for (const f of found) {
    if (people.some(p => { const o = iou(p.box, f.box); return o.iou > 0.3 || o.cover > 0.6; })) continue;
    people.push(f);
  }
  return people.slice(0, 6);
}

export function cancelTrack() { cancelFlag = true; }

// Theo dõi một người qua đoạn video [t0, t1]: mỗi khung cắt vùng quanh người đó rồi nhận diện.
export async function trackPose(v, { t0, t1, fps = 30, box, onProgress }) {
  await loadModel();
  await setMode('VIDEO', 1);
  cancelFlag = false;
  const W = v.videoWidth, H = v.videoHeight;
  const crop = document.createElement('canvas'); crop.width = crop.height = 384;
  let cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  let S = Math.max(box.w, box.h) * 1.5;
  const frames = [];
  const n = Math.max(1, Math.floor((t1 - t0) * fps) + 1);
  for (let k = 0; k < n; k++) {
    if (cancelFlag) throw new Error('cancelled');
    const t = t0 + k / fps;
    await seek(v, t);
    const c = { x: cx - S / 2, y: cy - S / 2, w: S, h: S };
    drawCrop(v, c, crop);
    lastTs += 34;
    const r = lm.detectForVideo(crop, lastTs);
    const l = r.landmarks?.[0];
    let kp = null;
    if (l) {
      kp = l.map(p => ({ x: c.x + p.x * S, y: c.y + p.y * S, v: p.visibility ?? 1 }));
      const bb = bboxOf(kp, 0.4);
      if (bb) {
        const ncx = bb.x + bb.w / 2, ncy = bb.y + bb.h / 2, nS = Math.max(64, Math.max(bb.w, bb.h) * 1.5);
        cx = 0.4 * cx + 0.6 * ncx; cy = 0.4 * cy + 0.6 * ncy; S = 0.7 * S + 0.3 * nS;
      }
    } else {
      S = Math.min(S * 1.15, Math.max(W, H));
    }
    frames.push({ t, kp });
    onProgress?.((k + 1) / n, crop, l);
  }
  return frames;
}
