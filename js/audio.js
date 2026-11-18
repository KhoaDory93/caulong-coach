// Tìm thời điểm vợt chạm cầu qua âm thanh: tiếng "tách" ngắn, đột ngột, nhiều tần số cao.
// Trả về [{t, strength}] (giây trên trục thời gian video), hoặc null nếu video không có âm thanh.

const HOP = 0.005; // 5 ms

export async function detectHits(blob, t0, t1) {
  let buf;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const data = await blob.arrayBuffer();
    buf = await new Promise((res, rej) => {
      const p = ac.decodeAudioData(data, res, rej);
      if (p && p.then) p.then(res, rej);
    });
    ac.close?.();
  } catch (e) {
    console.warn('Không đọc được âm thanh', e);
    return null;
  }
  const sr = buf.sampleRate;
  // trộn các kênh
  const n = buf.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += ch[i] / buf.numberOfChannels;
  }
  const hop = Math.max(1, Math.round(sr * HOP));
  const s0 = Math.max(1, Math.floor(t0 * sr)), s1 = Math.min(n, Math.ceil(t1 * sr));
  // năng lượng của tín hiệu sai phân (nhấn mạnh tần số cao / tiếng tách)
  const env = [];
  for (let i = s0; i < s1; i += hop) {
    let e = 0;
    const end = Math.min(i + hop, s1);
    for (let j = i; j < end; j++) { const d = mono[j] - mono[j - 1]; e += d * d; }
    env.push(e / (end - i));
  }
  if (env.length < 20) return [];
  const sorted = [...env].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] + 1e-12;
  const cands = [];
  for (let k = 6; k < env.length - 1; k++) {
    const v = env[k];
    if (v < med * 8) continue;
    let local = true;
    for (let j = Math.max(0, k - 6); j <= Math.min(env.length - 1, k + 6); j++) if (env[j] > v) { local = false; break; }
    if (!local) continue;
    // so với nền ngay trước đó (25–100 ms): phải tăng đột ngột
    let pre = 0, cnt = 0;
    for (let j = Math.max(0, k - 20); j <= k - 5; j++) { pre += env[j]; cnt++; }
    pre = pre / Math.max(1, cnt) + 1e-12;
    if (v / pre < 5) continue;
    cands.push({ t: t0 + (k + 0.5) * HOP, strength: v });
  }
  // gộp các đỉnh quá gần nhau (≤ 120 ms), giữ đỉnh mạnh nhất
  cands.sort((a, b) => b.strength - a.strength);
  const hits = [];
  for (const c of cands) if (hits.every(h => Math.abs(h.t - c.t) > 0.12)) hits.push(c);
  return hits.sort((a, b) => a.t - b.t);
}
