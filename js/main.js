import { STROKES, VIEWS, fmtValue, STATUS_LABEL } from './criteria.js';
import { evaluate, keyTimes } from './analysis.js';
import { drawSkeleton, contentRect, fitCanvas } from './draw.js';
import * as db from './storage.js';

const $ = s => document.querySelector(s);
const FPS = 30;
const MAX_LEN = 60;
let poseMod = null;
const pose = async () => (poseMod ||= await import('./pose.js'));

const state = {
  stroke: 'clear', hand: 'auto', view: 'side',
  url: null, fileName: '', t0: 0, t1: 0,
  people: [], target: null, drawMode: false, drawing: null,
  live: null,      // dữ liệu của lần phân tích vừa chạy (còn video trong bộ nhớ)
  rec: null, swingSel: -1,
};
try {
  const p = JSON.parse(localStorage.getItem('cl-prefs') || '{}');
  if (STROKES[p.stroke]) state.stroke = p.stroke;
  if (['auto', 'R', 'L'].includes(p.hand)) state.hand = p.hand;
} catch {}
const savePrefs = () => { try { localStorage.setItem('cl-prefs', JSON.stringify({ stroke: state.stroke, hand: state.hand })); } catch {} };

// ---------------- điều hướng ----------------
const TITLES = { home: 'Cầu Lông Coach', setup: 'Chuẩn bị phân tích', progress: 'Đang phân tích', result: 'Kết quả', history: 'Lịch sử', criteria: 'Bộ tiêu chí' };
const VIEWS_ALL = Object.keys(TITLES);
let stack = ['home'];
function show(name, push = true) {
  for (const v of VIEWS_ALL) $('#v-' + v).hidden = v !== name;
  if (push && stack[stack.length - 1] !== name) stack.push(name);
  $('#back').hidden = name === 'home';
  $('#title').textContent = TITLES[name];
  $('#nav-history').hidden = name === 'history' || name === 'progress';
  if (name !== 'result') $('#res-vid').pause();
  if (name !== 'setup') $('#vid').pause();
  window.scrollTo(0, 0);
}
$('#back').onclick = () => {
  if (!$('#v-progress').hidden) { pose().then(p => p.cancelTrack()); return; }
  stack.pop();
  const to = stack[stack.length - 1] || 'home';
  show(to, false);
  if (to === 'history') renderHistory();
  if (to === 'setup') requestAnimationFrame(drawPick);
};
$('#nav-history').onclick = () => { renderHistory(); show('history'); };
$('#nav-criteria').onclick = () => { renderCriteriaDoc(); show('criteria'); };

function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------- trang chủ ----------------
function renderHome() {
  $('#stroke-list').innerHTML = Object.entries(STROKES).map(([k, s]) => `
    <button class="stroke" role="radio" aria-checked="${k === state.stroke}" data-k="${k}">
      <span class="dot"></span>
      <span><b>${esc(s.name)}</b><small>${esc(s.desc)}</small></span>
    </button>`).join('');
  $('#stroke-tips').innerHTML = STROKES[state.stroke].tips.map(t => `<li>${esc(t)}</li>`).join('');
}
$('#stroke-list').onclick = e => {
  const b = e.target.closest('.stroke');
  if (!b) return;
  state.stroke = b.dataset.k; savePrefs(); renderHome();
};
for (const id of ['#in-camera', '#in-file']) {
  $(id).onchange = e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) loadVideo(f, f.name || 'video');
  };
}

// ---------------- thiết lập ----------------
const vid = $('#vid'), pick = $('#pick');

async function loadVideo(blob, name) {
  if (state.url && state.url !== state.live?.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(blob);
  state.fileName = name;
  state.people = []; state.target = null; state.drawMode = false;
  state.view = STROKES[state.stroke].defaultView;
  vid.src = state.url;
  try {
    await new Promise((res, rej) => { vid.onloadedmetadata = res; vid.onerror = () => rej(new Error('Không mở được video này')); });
  } catch (e) { toast(e.message + '. Hãy thử định dạng MP4/MOV khác.'); return; }
  state.t0 = 0;
  state.t1 = Math.min(vid.duration, MAX_LEN);
  if (vid.duration > MAX_LEN) toast(`Video dài ${Math.round(vid.duration)} giây — mặc định chỉ phân tích ${MAX_LEN} giây đầu. Hãy chọn đoạn có động tác.`, 6000);
  vid.currentTime = 0;
  renderSetup();
  show('setup');
  requestAnimationFrame(drawPick);
}

function renderSetup() {
  $('#trim-label').textContent = `${state.t0.toFixed(1)}s – ${state.t1.toFixed(1)}s (${(state.t1 - state.t0).toFixed(1)}s)`;
  for (const b of $('#seg-hand').children) b.setAttribute('aria-pressed', b.dataset.v === state.hand);
  for (const b of $('#seg-view').children) b.setAttribute('aria-pressed', b.dataset.v === state.view);
  $('#analyze').disabled = !state.target || state.t1 - state.t0 < 0.3;
  $('#draw-box').textContent = state.drawMode ? 'Đang khoanh… (kéo trên video)' : 'Tự khoanh vùng';
  pick.style.touchAction = state.drawMode ? 'none' : 'manipulation';
  const msg = $('#pick-msg');
  if (state.target) msg.textContent = 'Đã chọn người chơi (khung vàng). Có thể chọn lại, hoặc bấm Phân tích.';
  else if (state.drawMode) msg.textContent = 'Kéo một khung bao quanh toàn thân người chơi trên video.';
  else if (state.people.length) msg.textContent = `Tìm thấy ${state.people.length} người. Chạm vào người cần chấm.`;
}
$('#seg-hand').onclick = e => { const v = e.target.dataset?.v; if (v) { state.hand = v; savePrefs(); renderSetup(); } };
$('#seg-view').onclick = e => { const v = e.target.dataset?.v; if (v) { state.view = v; renderSetup(); } };

$('#play').onclick = () => (vid.paused ? vid.play() : vid.pause());
vid.onplay = () => ($('#play').textContent = '❚❚');
vid.onpause = () => ($('#play').textContent = '▶');
vid.ontimeupdate = () => {
  $('#seek').value = Math.round(1000 * vid.currentTime / (vid.duration || 1));
  $('#time').textContent = vid.currentTime.toFixed(1) + 's';
  drawPick();
};
vid.onseeked = drawPick;
$('#seek').oninput = e => { vid.pause(); vid.currentTime = e.target.value / 1000 * (vid.duration || 0); };
const clearPick = () => { state.people = []; state.target = null; };
$('#set-start').onclick = () => {
  state.t0 = Math.min(vid.currentTime, state.t1 - 0.3);
  if (state.t1 - state.t0 > MAX_LEN) state.t1 = state.t0 + MAX_LEN;
  clearPick(); renderSetup(); drawPick();
};
$('#set-end').onclick = () => {
  state.t1 = Math.max(vid.currentTime, state.t0 + 0.3);
  if (state.t1 - state.t0 > MAX_LEN) { state.t0 = state.t1 - MAX_LEN; clearPick(); }
  renderSetup();
};
$('#reset-trim').onclick = () => { state.t0 = 0; state.t1 = Math.min(vid.duration, MAX_LEN); clearPick(); renderSetup(); drawPick(); };

$('#find').onclick = async () => {
  const btn = $('#find');
  btn.disabled = true;
  vid.pause();
  try {
    $('#pick-msg').textContent = 'Đang tải mô hình AI (lần đầu ~10 MB)…';
    const p = await pose();
    await p.loadModel();
    $('#pick-msg').textContent = 'Đang tìm người chơi…';
    state.people = await p.findPeople(vid, state.t0);
    state.target = state.people.length === 1 ? state.people[0].box : null;
    state.drawMode = false;
    if (!state.people.length) $('#pick-msg').textContent = 'Không tìm thấy ai. Hãy dùng “Tự khoanh vùng”.';
    else renderSetup();
  } catch (e) {
    console.error(e);
    $('#pick-msg').textContent = 'Lỗi tải mô hình AI — kiểm tra kết nối mạng rồi thử lại.';
  } finally { btn.disabled = false; drawPick(); $('#analyze').disabled = !state.target; }
};
$('#draw-box').onclick = async () => {
  state.drawMode = !state.drawMode;
  if (state.drawMode) { vid.pause(); vid.currentTime = state.t0; }
  renderSetup(); drawPick();
};

function toVideo(e) {
  const r = contentRect(vid, vid.videoWidth, vid.videoHeight);
  const b = pick.getBoundingClientRect();
  return { x: (e.clientX - b.left - r.ox) / r.s, y: (e.clientY - b.top - r.oy) / r.s };
}
pick.addEventListener('pointerdown', e => {
  if (!vid.videoWidth) return;
  const p = toVideo(e);
  if (state.drawMode) {
    state.drawing = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    pick.setPointerCapture(e.pointerId);
    return;
  }
  if (!state.people.length || Math.abs(vid.currentTime - state.t0) > 0.06) return;
  const hits = state.people.filter(q => {
    const m = 0.15 * q.box.h;
    return p.x >= q.box.x - m && p.x <= q.box.x + q.box.w + m && p.y >= q.box.y - m && p.y <= q.box.y + q.box.h + m;
  }).sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h);
  if (hits[0]) { state.target = hits[0].box; renderSetup(); drawPick(); }
});
pick.addEventListener('pointermove', e => {
  if (!state.drawing) return;
  const p = toVideo(e);
  state.drawing.x1 = p.x; state.drawing.y1 = p.y;
  drawPick();
});
pick.addEventListener('pointerup', () => {
  const d = state.drawing;
  if (!d) return;
  state.drawing = null;
  const box = { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) };
  if (box.w > 12 && box.h > 12) { state.target = box; state.people = []; state.drawMode = false; }
  renderSetup(); drawPick();
});

function drawPick() {
  if ($('#v-setup').hidden || !vid.videoWidth) return;
  const r = contentRect(vid, vid.videoWidth, vid.videoHeight);
  const ctx = fitCanvas(pick, r.cw, r.ch);
  ctx.clearRect(0, 0, r.cw, r.ch);
  const map = p => ({ x: r.ox + p.x * r.s, y: r.oy + p.y * r.s });
  const atStart = Math.abs(vid.currentTime - state.t0) < 0.06;
  const rect = (b, color, w, dash) => {
    const a = map(b), z = map({ x: b.x + b.w, y: b.y + b.h });
    ctx.setLineDash(dash || []); ctx.lineWidth = w; ctx.strokeStyle = color;
    ctx.strokeRect(a.x, a.y, z.x - a.x, z.y - a.y); ctx.setLineDash([]);
    return a;
  };
  if (atStart) {
    state.people.forEach((p, i) => {
      const sel = state.target === p.box;
      drawSkeleton(ctx, p.kp, map, { scale: 0.7 });
      const a = rect(pad(p.box), sel ? '#ffcc00' : '#ffffff', sel ? 3 : 2, sel ? null : [6, 4]);
      ctx.fillStyle = sel ? '#ffcc00' : '#ffffff';
      ctx.font = 'bold 15px system-ui';
      ctx.fillText(String(i + 1), a.x + 4, a.y - 5 < 12 ? a.y + 16 : a.y - 5);
    });
    if (state.target && !state.people.some(p => p.box === state.target)) rect(state.target, '#ffcc00', 3);
  }
  if (state.drawing) {
    const d = state.drawing;
    rect({ x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) }, '#ffcc00', 2, [5, 4]);
  }
  if (state.drawMode && !state.drawing) {
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, r.cw, 34);
    ctx.fillStyle = '#fff'; ctx.font = '600 14px system-ui';
    ctx.fillText('Kéo để khoanh vùng người chơi', 10, 22);
  }
}
const pad = b => ({ x: b.x - b.w * 0.1, y: b.y - b.h * 0.08, w: b.w * 1.2, h: b.h * 1.16 });
window.addEventListener('resize', () => { drawPick(); drawOverlay(); });

// ---------------- phân tích ----------------
$('#analyze').onclick = async () => {
  vid.play().then(() => vid.pause()).catch(() => {}); // iOS: "đánh thức" video bằng thao tác người dùng
  const prog = (msg, frac) => { if (msg) $('#prog-msg').textContent = msg; if (frac != null) $('#bar').style.width = (frac * 100).toFixed(1) + '%'; };
  show('progress', false);
  prog('Đang tải mô hình AI…', 0);
  const live = $('#live').getContext('2d');
  try {
    const p = await pose();
    await p.loadModel();
    const t0 = state.t0, t1 = state.t1;
    const total = Math.floor((t1 - t0) * FPS) + 1;
    const frames = await p.trackPose(vid, {
      t0, t1, fps: FPS, box: state.target,
      onProgress: (f, crop, l) => {
        prog(`Đang nhận diện tư thế… ${Math.round(f * total)}/${total} khung hình`, f * 0.92);
        live.drawImage(crop, 0, 0, 384, 384);
        if (l) drawSkeleton(live, l.map(q => ({ x: q.x, y: q.y, v: q.visibility ?? 1 })), q => ({ x: q.x * 384, y: q.y * 384 }), { side: state.hand === 'L' ? 'L' : 'R', scale: 1.2 });
      },
    });
    prog('Đang chấm điểm…', 0.94);
    const opts = { stroke: state.stroke, view: state.view, hand: state.hand };
    const res = evaluate(frames, opts);
    if (res.error) { show('setup', false); toast(res.error, 7000); return; }
    prog('Đang tạo ảnh minh hoạ…', 0.96);
    const keyframes = await makeKeyframes(p, res, t0, t1);
    const rec = {
      id: Date.now().toString(36), date: Date.now(), ...opts,
      side: res.side, sideAuto: res.sideAuto, fileName: state.fileName, t0, t1,
      score: res.score, summary: res.summary, warnings: res.warnings, quality: res.quality,
      swings: res.swings.map(s => ({ t: s.t, weak: s.weak, score: s.score, results: s.results })),
      keyframes,
    };
    try { await db.save(rec); } catch (e) { console.warn(e); toast('Không lưu được vào lịch sử trên máy.'); }
    state.live = { recId: rec.id, url: state.url, frames: res.frames, t0, side: res.side };
    prog('Xong', 1);
    openResult(rec);
  } catch (e) {
    if (e.message === 'cancelled') { show('setup', false); toast('Đã huỷ.'); return; }
    console.error(e);
    show('setup', false);
    toast('Có lỗi khi phân tích: ' + e.message, 7000);
  }
};
$('#cancel').onclick = () => pose().then(p => p.cancelTrack());

function nearestFrame(frames, t) {
  let best = null, bd = 1e9;
  for (const f of frames) { const d = Math.abs(f.t - t); if (d < bd && f.kp) { bd = d; best = f; } }
  return bd < 0.1 ? best : null;
}

async function makeKeyframes(p, res, t0, t1) {
  const out = [];
  const c = document.createElement('canvas'); c.width = 240; c.height = 320;
  const ctx = c.getContext('2d');
  for (let s = 0; s < Math.min(res.swings.length, 10); s++) {
    for (const [label, t] of keyTimes(state.stroke, res.swings[s], t0, t1)) {
      const f = nearestFrame(res.frames, t);
      await p.seek(vid, t);
      let box;
      if (f) {
        const pts = f.kp.filter(q => q.v > 0.2);
        const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const h = Math.max((Math.max(...ys) - Math.min(...ys)) * 1.35, (Math.max(...xs) - Math.min(...xs)) * 1.35 * 4 / 3, 60);
        box = { x: cx - h * 3 / 8, y: cy - h / 2, w: h * 3 / 4, h };
      } else {
        box = { ...state.target };
      }
      p.drawCrop(vid, box, c);
      if (f) drawSkeleton(ctx, f.kp, q => ({ x: (q.x - box.x) * 240 / box.w, y: (q.y - box.y) * 320 / box.h }), { side: res.side, scale: 1 });
      out.push({ swing: s, label, t, img: c.toDataURL('image/jpeg', 0.78) });
    }
  }
  return out;
}

// ---------------- kết quả ----------------
const rvid = $('#res-vid'), overlay = $('#overlay');
const CIRC = 2 * Math.PI * 52;

function scoreColor(s) { return s == null ? 'var(--na)' : s >= 80 ? 'var(--good)' : s >= 55 ? 'var(--ok)' : 'var(--bad)'; }

function openResult(rec) {
  state.rec = rec;
  const S = STROKES[rec.stroke];
  const fg = $('#ring-fg');
  fg.style.strokeDasharray = CIRC;
  fg.style.strokeDashoffset = CIRC * (1 - (rec.score ?? 0) / 100);
  fg.style.stroke = scoreColor(rec.score);
  $('#ring-text').textContent = rec.score ?? '–';
  $('#res-stroke').textContent = S.name;
  const d = new Date(rec.date);
  $('#res-meta').textContent = `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · Góc ${VIEWS[rec.view].toLowerCase()} · Tay ${rec.side === 'R' ? 'phải' : 'trái'}${rec.sideAuto ? ' (tự nhận)' : ''}`;
  const unit = S.event === 'lunge' ? 'lần lên lưới' : 'cú đánh';
  $('#res-sub').textContent = `Phát hiện ${rec.swings.length} ${unit}. Điểm trên 100, chấm theo bộ tiêu chí v0.1.`;
  $('#warnings').innerHTML = (rec.warnings || []).map(w => `<div class="warn">${esc(w)}</div>`).join('');

  const hasVideo = state.live?.recId === rec.id;
  $('#res-video-wrap').hidden = !hasVideo;
  if (hasVideo) {
    if (rvid.src !== state.live.url) rvid.src = state.live.url;
    rvid.playbackRate = 0.5;
    for (const b of $('#seg-speed').children) b.setAttribute('aria-pressed', b.dataset.v === '0.5');
  }

  const chips = [`<button class="chip" data-k="-1">Tổng hợp</button>`]
    .concat(rec.swings.map((s, k) => `<button class="chip" data-k="${k}">${S.event === 'lunge' ? 'Lần' : 'Cú'} ${k + 1} · ${s.score ?? '–'}</button>`));
  $('#swing-chips').innerHTML = rec.swings.length > 1 ? chips.join('') : '';
  selectSwing(rec.swings.length > 1 ? -1 : 0);
  show('result');
  requestAnimationFrame(drawOverlay);
}
$('#swing-chips').onclick = e => { const b = e.target.closest('.chip'); if (b) selectSwing(+b.dataset.k); };

function selectSwing(k) {
  const rec = state.rec, S = STROKES[rec.stroke];
  state.swingSel = k;
  for (const b of $('#swing-chips').children) b.setAttribute('aria-pressed', +b.dataset.k === k);
  const results = k < 0 ? rec.summary : rec.swings[k]?.results || [];
  const kfSwing = Math.max(0, k);
  $('#keyframes').innerHTML = rec.keyframes.filter(f => f.swing === kfSwing)
    .map(f => `<figure><img src="${f.img}" alt="${esc(f.label)}"><figcaption>${esc(f.label)} · ${f.t.toFixed(2)}s</figcaption></figure>`).join('');

  const crit = id => S.criteria.find(c => c.id === id);
  const todo = results.filter(r => r.status === 'ok' || r.status === 'bad')
    .sort((a, b) => crit(b.id).weight * (100 - b.score) - crit(a.id).weight * (100 - a.score)).slice(0, 3);
  $('#todo').innerHTML = todo.length
    ? todo.map(r => `<li><b>${esc(crit(r.id).name)}</b> — ${esc(crit(r.id).fix)}</li>`).join('')
    : '<li>Không có điểm nào cần ưu tiên — giữ vững phong độ! Hãy thử quay ở góc khác để kiểm tra thêm.</li>';

  $('#crit-list').innerHTML = results.map(r => {
    const c = crit(r.id);
    let meas;
    if (r.status === 'na') {
      meas = r.reason === 'view'
        ? `Không đo được ở góc quay này (cần góc: ${c.views.map(v => VIEWS[v].toLowerCase()).join(', ')}).`
        : 'Không đủ dữ liệu (khớp bị che hoặc ra ngoài khung hình).';
    } else {
      meas = `Đo được: <b>${fmtValue(c, r.value)}</b>${k < 0 && r.n > 1 ? ` (trung vị · đạt Tốt ${r.nGood}/${r.n} lần)` : ''} · Mục tiêu: ${esc(c.target)}`;
    }
    const fix = r.status === 'ok' || r.status === 'bad'
      ? `<p class="fix"><b>Cách sửa:</b> ${esc(c.fix)}</p><p class="fix"><b>Bài tập:</b> ${esc(c.drill)}</p>` : '';
    return `<div class="crit ${r.status}">
      <div class="crit-head"><b>${esc(c.name)}</b><span class="badge ${r.status}">${STATUS_LABEL[r.status]}</span></div>
      <p class="meas">${meas}</p>
      <p class="why">${esc(c.why)}</p>${fix}</div>`;
  }).join('');

  if (state.live?.recId === rec.id && k >= 0) {
    rvid.pause();
    rvid.currentTime = Math.max(0, rec.swings[k].t - 0.6);
  }
}

$('#res-play').onclick = () => (rvid.paused ? rvid.play() : rvid.pause());
$('#seg-speed').onclick = e => {
  const v = e.target.dataset?.v;
  if (!v) return;
  rvid.playbackRate = +v;
  for (const b of $('#seg-speed').children) b.setAttribute('aria-pressed', b.dataset.v === v);
};
$('#res-seek').oninput = e => { rvid.pause(); rvid.currentTime = e.target.value / 1000 * (rvid.duration || 0); };
rvid.onplay = () => { $('#res-play').textContent = '❚❚'; loop(); };
rvid.onpause = () => ($('#res-play').textContent = '▶');
rvid.onseeked = drawOverlay;
rvid.onloadeddata = drawOverlay;
rvid.ontimeupdate = () => { $('#res-seek').value = Math.round(1000 * rvid.currentTime / (rvid.duration || 1)); };
function loop() { drawOverlay(); if (!rvid.paused && !rvid.ended) requestAnimationFrame(loop); }

function drawOverlay() {
  if ($('#v-result').hidden || $('#res-video-wrap').hidden || !rvid.videoWidth || !state.live) return;
  const r = contentRect(rvid, rvid.videoWidth, rvid.videoHeight);
  const ctx = fitCanvas(overlay, r.cw, r.ch);
  ctx.clearRect(0, 0, r.cw, r.ch);
  const t = rvid.currentTime;
  const f = nearestFrame(state.live.frames, t);
  if (f) drawSkeleton(ctx, f.kp, p => ({ x: r.ox + p.x * r.s, y: r.oy + p.y * r.s }), { side: state.live.side, scale: Math.max(0.8, r.s * 1.2) });
  const hit = state.rec.swings.findIndex(s => Math.abs(s.t - t) < 0.07);
  if (hit >= 0) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, 8, 150, 30);
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 15px system-ui';
    ctx.fillText(`${STROKES[state.rec.stroke].event === 'lunge' ? 'Lunge' : 'Chạm cầu'} #${hit + 1}`, 16, 28);
  }
}

$('#again').onclick = () => { stack = ['home']; show('home', false); };

// ---------------- lịch sử ----------------
async function renderHistory() {
  const el = $('#history-list');
  let list = [];
  try { list = await db.all(); } catch (e) { el.innerHTML = '<p class="empty">Không đọc được lịch sử trên máy này.</p>'; return; }
  if (!list.length) { el.innerHTML = '<p class="empty">Chưa có lần phân tích nào.</p>'; return; }
  el.innerHTML = list.map(r => {
    const d = new Date(r.date);
    const thumb = r.keyframes?.find(k => k.label === 'Chạm cầu')?.img || r.keyframes?.[0]?.img || '';
    return `<div class="hist" data-id="${r.id}">
      ${thumb ? `<img src="${thumb}" alt="">` : '<img alt="">'}
      <div class="info"><b>${esc(STROKES[r.stroke]?.name || r.stroke)}</b><br>
        <span class="muted">${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${r.swings.length} lần</span></div>
      <span class="score" style="color:${scoreColor(r.score)}">${r.score ?? '–'}</span>
      <button class="btn sm ghost del" data-id="${r.id}" aria-label="Xoá">Xoá</button>
    </div>`;
  }).join('');
}
$('#history-list').onclick = async e => {
  const del = e.target.closest('.del');
  if (del) {
    e.stopPropagation();
    if (del.dataset.armed) { await db.remove(del.dataset.id); renderHistory(); }
    else { del.dataset.armed = '1'; del.textContent = 'Xoá hẳn?'; del.classList.add('danger'); }
    return;
  }
  const row = e.target.closest('.hist');
  if (row) { const rec = await db.get(row.dataset.id); if (rec) openResult(rec); }
};

// ---------------- bộ tiêu chí ----------------
function renderCriteriaDoc() {
  const th = c => c.better === 'range'
    ? `Tốt: ${fmtValue(c, c.good[0])} → ${fmtValue(c, c.good[1])}; Tạm được: ${fmtValue(c, c.ok[0])} → ${fmtValue(c, c.ok[1])}`
    : `Tốt: ${c.better === 'higher' ? '≥' : '≤'} ${fmtValue(c, c.good)}; Tạm được: ${c.better === 'higher' ? '≥' : '≤'} ${fmtValue(c, c.ok)}`;
  $('#criteria-doc').innerHTML = Object.values(STROKES).map(S => `
    <div class="doc-stroke card">
      <h3 style="margin-top:0">${esc(S.name)}</h3>
      <p class="muted">${esc(S.desc)} Góc quay khuyên dùng: ${esc(VIEWS[S.defaultView].toLowerCase())}.</p>
      ${S.criteria.map((c, i) => `<div class="doc-crit">
        <b>${i + 1}. ${esc(c.name)}</b> <span class="muted">(trọng số ${c.weight})</span>
        <p><b>Mục tiêu:</b> ${esc(c.target)}</p>
        <p><b>Ngưỡng:</b> ${th(c)}</p>
        <p><b>Góc quay đo được:</b> ${c.views.map(v => VIEWS[v].toLowerCase()).join(', ')}</p>
        <p><b>Vì sao:</b> ${esc(c.why)}</p>
        <p><b>Cách sửa:</b> ${esc(c.fix)}</p>
        <p><b>Bài tập:</b> ${esc(c.drill)}</p>
      </div>`).join('')}
    </div>`).join('');
}

// ---------------- khởi động ----------------
renderHome();
// Chế độ thử nghiệm: ?test=<đường dẫn video>&stroke=drive
const qs = new URLSearchParams(location.search);
if (qs.get('test')) {
  if (STROKES[qs.get('stroke')]) state.stroke = qs.get('stroke');
  renderHome();
  fetch(qs.get('test')).then(r => r.blob()).then(b => loadVideo(b, qs.get('test').split('/').pop()));
}
