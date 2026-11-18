// Bộ tiêu chí kỹ thuật (bản nháp v0.1) — mọi ngưỡng có thể chỉnh tại đây.
//
// Đơn vị đo:
//   T   = chiều dài thân (từ giữa hai vai đến giữa hai hông). Hiển thị quy đổi ≈ 50 cm / 1 T.
//   deg = độ (góc khớp hoặc góc nghiêng)
//   s   = giây
// better: 'higher' (càng lớn càng tốt), 'lower' (càng nhỏ càng tốt), 'range' (nằm trong khoảng)
// good / ok: ngưỡng đạt "Tốt" và "Tạm được". Dưới ngưỡng ok là "Cần sửa".
// views: các góc quay mà tiêu chí đo được tin cậy (side = ngang/bên hông, front = trước mặt, back = sau lưng).

export const CM_PER_T = 50;

export const VIEWS = {
  side: 'Ngang (bên hông)',
  front: 'Trước mặt',
  back: 'Sau lưng',
};

const ALL = ['side', 'front', 'back'];

export const STROKES = {
  clear: {
    name: 'Phông cầu cao sâu',
    desc: 'Cú đánh trên đầu thuận tay, đưa cầu cao và sâu về cuối sân đối phương.',
    defaultView: 'side',
    event: 'swing',
    minSpeed: 3.0,      // T/giây — tốc độ cổ tay tối thiểu để tính là một cú vung
    minGap: 0.7,        // giây giữa 2 cú
    prep: [-0.8, -0.08],
    contact: [-0.1, 0.1],
    finish: [0.08, 0.6],
    keyOffsets: { prep: -0.3, contact: 0, finish: 0.3 },
    tips: [
      'Đặt điện thoại ngang hông người chơi (vuông góc với chiều dài sân), cách 4–6 m, cao ngang ngực.',
      'Hoặc đặt phía sau người chơi, cao trên 1,5 m để thấy rõ tay vợt trên đầu.',
      'Toàn thân và cả cây vợt khi giơ cao phải nằm trong khung hình.',
    ],
    criteria: [
      {
        id: 'c_offarm', name: 'Tay không cầm vợt nâng cao chỉ cầu', views: ALL, weight: 1,
        fmt: 'cm', better: 'higher', good: 0, ok: -0.3,
        target: 'Cổ tay cao ngang hoặc hơn vai trong pha chuẩn bị',
        why: 'Giúp định vị cầu, giữ thăng bằng và tạo lực xoay thân khi kéo tay xuống.',
        fix: 'Khi di chuyển lùi về sau, giơ tay không cầm vợt lên cao hướng về quả cầu; lúc vung vợt thì kéo tay này xuống sát bụng.',
        drill: 'Đứng nghiêng người, tay không cầm vợt chỉ lên cầu được tung lên, bắt cầu bằng tay đó — 3 × 15 lần.',
      },
      {
        id: 'c_elbow_up', name: 'Khuỷu tay vợt nâng cao khi chuẩn bị', views: ALL, weight: 1,
        fmt: 'cm', better: 'higher', good: -0.1, ok: -0.35,
        target: 'Khuỷu tay ngang vai hoặc cao hơn trước khi vung',
        why: 'Khuỷu thấp làm đường vung ngắn, điểm đánh thấp và dễ đau vai.',
        fix: 'Đưa vợt ra sau đầu, khuỷu tay chỉ lên trần nhà, cánh tay trên song song mặt sàn hoặc cao hơn.',
        drill: 'Vung vợt không cầu trước gương, dừng ở tư thế chuẩn bị 2 giây kiểm tra khuỷu — 3 × 20 lần.',
      },
      {
        id: 'c_contact_high', name: 'Điểm tiếp xúc cao', views: ALL, weight: 1.5,
        fmt: 'cm', better: 'higher', good: 0.55, ok: 0.3,
        target: 'Cổ tay cao hơn đầu khoảng ≥ 28 cm lúc chạm cầu',
        why: 'Điểm đánh càng cao, cầu đi càng xa, càng có góc và càng sớm.',
        fix: 'Di chuyển nhanh ra sau quả cầu để cầu rơi phía trước-trên đầu; với tay lên đánh cầu ở điểm cao nhất.',
        drill: 'Treo cầu ở độ cao với tay + 20 cm, vung chạm cầu bằng tay duỗi thẳng — 3 × 15 lần.',
      },
      {
        id: 'c_extend', name: 'Duỗi tay khi chạm cầu', views: ALL, weight: 1,
        fmt: 'deg', better: 'higher', good: 155, ok: 135,
        target: 'Góc khuỷu tay ≥ 155° lúc chạm cầu',
        why: 'Tay duỗi giúp tận dụng chiều cao và truyền lực trọn vẹn.',
        fix: 'Vươn tay hết cỡ lên trên lúc chạm cầu thay vì đánh khi khuỷu còn gập.',
        drill: 'Đập bóng tường/treo cầu: chú ý cảm giác tay duỗi thẳng tại điểm chạm — 3 × 15 lần.',
      },
      {
        id: 'c_rotation', name: 'Xoay vai (nghiêng người rồi mở vai)', views: ALL, weight: 1.5,
        fmt: 'cm', better: 'higher', good: 0.35, ok: 0.15,
        target: 'Biên độ thay đổi độ rộng vai ≥ ~18 cm từ chuẩn bị đến chạm cầu',
        why: 'Lực phông cầu đến từ xoay thân, không chỉ từ tay.',
        fix: 'Chuẩn bị với vai không cầm vợt hướng về lưới (người nghiêng); khi vung, xoay hông rồi vai để ngực mở về phía lưới.',
        drill: 'Tập xoay người với dây kháng lực hoặc vung vợt bóng (cover) nặng — 3 × 12 lần.',
      },
      {
        id: 'c_follow', name: 'Vung theo trọn vẹn', views: ALL, weight: 1,
        fmt: 'cm', better: 'lower', good: -0.5, ok: -0.1,
        target: 'Sau khi đánh, cổ tay về thấp hơn vai ≥ 25 cm (vợt kết thúc chéo trước người)',
        why: 'Vung theo giúp giảm chấn thương và cho thấy lực được giải phóng hết.',
        fix: 'Không dừng vợt ngay sau khi chạm cầu; để vợt đi tiếp xuống chéo về phía hông bên kia.',
        drill: 'Vung không cầu chậm 3 nhịp: chuẩn bị – chạm – kết thúc ở hông đối diện — 3 × 20 lần.',
      },
      {
        id: 'c_knee', name: 'Chùng gối lấy đà', views: ALL, weight: 0.5,
        fmt: 'deg', better: 'lower', good: 160, ok: 170,
        target: 'Gối chân sau gập ≤ 160° trong pha chuẩn bị',
        why: 'Chùng gối rồi đạp đất giúp truyền lực từ chân lên thân.',
        fix: 'Dồn trọng tâm vào chân sau, hơi khuỵu gối trước khi vung, rồi đạp chân sau khi đánh.',
        drill: 'Bước lùi chéo + bật nhảy kéo (scissor jump) không cầu — 3 × 10 lần.',
      },
    ],
  },

  net: {
    name: 'Bỏ nhỏ / kê lưới',
    desc: 'Lên lưới bằng bước lunge, đón cầu sớm và đánh nhẹ sát lưới.',
    defaultView: 'side',
    event: 'lunge',
    maxKnee: 140,       // góc gối trước tối đa để tính là một lần lunge
    minGap: 0.8,
    prep: [-0.8, -0.1],
    contact: [-0.25, 0.15],
    finish: [0.2, 1.2],
    keyOffsets: { prep: -0.5, contact: 0, finish: 0.5 },
    tips: [
      'Đặt điện thoại ngang hông người chơi (nhìn thấy cả bước lunge từ bên cạnh), cách 4–6 m, cao ngang hông.',
      'Quay từ lúc đứng ở giữa sân, lên lưới, đến khi lùi về giữa sân.',
      'Toàn thân phải nằm trong khung hình, kể cả bàn chân.',
    ],
    criteria: [
      {
        id: 'n_lunge', name: 'Bước lunge đủ sâu', views: ['side'], weight: 1,
        fmt: 'deg', better: 'lower', good: 125, ok: 145,
        target: 'Góc gối chân trước ≤ 125° tại điểm lunge',
        why: 'Lunge sâu giúp với cầu xa hơn và sớm hơn mà vẫn vững.',
        fix: 'Bước dài hơn bằng chân thuận, hạ hông xuống thay vì chỉ cúi người.',
        drill: 'Lunge về 2 góc lưới có đặt mục tiêu chạm cầu — 3 × 10 lần mỗi bên.',
      },
      {
        id: 'n_back_leg', name: 'Chân sau giữ thẳng, làm trụ', views: ['side'], weight: 0.75,
        fmt: 'deg', better: 'higher', good: 140, ok: 120,
        target: 'Góc gối chân sau ≥ 140°',
        why: 'Chân sau gần thẳng làm điểm tựa, giúp đẩy về giữa sân nhanh.',
        fix: 'Giữ chân sau dài, đầu gối không chạm sàn; mũi chân sau có thể kéo lê theo.',
        drill: 'Lunge tĩnh giữ 3 giây kiểm tra chân sau — 3 × 10 lần.',
      },
      {
        id: 'n_shin', name: 'Gối trước không đổ quá mũi chân', views: ['side'], weight: 1,
        fmt: 'deg', better: 'lower', good: 20, ok: 35,
        target: 'Ống chân trước nghiêng ≤ 20° so với phương thẳng đứng',
        why: 'Gối đổ quá xa về trước gây áp lực lớn lên khớp gối.',
        fix: 'Tiếp đất bằng gót chân trước, giữ gối ở trên khoảng cổ chân; bước dài thay vì đổ gối.',
        drill: 'Lunge tiếp đất bằng gót trên vạch kẻ, kiểm tra gối không vượt mũi giày — 3 × 10.',
      },
      {
        id: 'n_hand_high', name: 'Đón cầu sớm – vợt ở cao', views: ALL, weight: 1.5,
        fmt: 'cm', better: 'higher', good: 0.5, ok: 0.1,
        target: 'Cổ tay cao hơn hông ≥ 25 cm khi chạm cầu',
        why: 'Đánh cầu ở điểm cao giúp cầu đi sát lưới và có nhiều lựa chọn hơn.',
        fix: 'Đưa vợt lên trước ngay khi bắt đầu lên lưới, mặt vợt hướng lên; đón cầu càng gần mép lưới càng tốt.',
        drill: 'Người đút cầu ném nhanh sát lưới, bạn lên chạm cầu trên mép lưới — 3 × 15.',
      },
      {
        id: 'n_arm_reach', name: 'Tay vợt vươn ra trước', views: ['side'], weight: 1,
        fmt: 'deg', better: 'higher', good: 140, ok: 115,
        target: 'Góc khuỷu tay ≥ 140° khi chạm cầu',
        why: 'Vươn tay giúp tiếp cầu xa mà không cần bước thêm.',
        fix: 'Duỗi tay về phía cầu trước khi chân tiếp đất, tránh co tay sát người.',
        drill: 'Shadow lên lưới: chân và tay vươn tới cùng lúc, giữ tư thế 2 giây — 3 × 10.',
      },
      {
        id: 'n_trunk', name: 'Thân trên thẳng, không gập người', views: ALL, weight: 1,
        fmt: 'deg', better: 'lower', good: 25, ok: 40,
        target: 'Thân nghiêng ≤ 25° so với phương thẳng đứng',
        why: 'Gập người làm mất thăng bằng và chậm hồi về.',
        fix: 'Giữ ngực mở, lưng thẳng; với cầu bằng chân và tay chứ không cúi lưng.',
        drill: 'Lunge với gậy đặt dọc sống lưng để giữ lưng thẳng — 3 × 10.',
      },
      {
        id: 'n_recover', name: 'Thu hồi về giữa sân', views: ['side'], weight: 1,
        fmt: 'pct', better: 'higher', good: 0.6, ok: 0.3,
        target: 'Lùi lại ≥ 60% quãng đường lunge trong 1 giây sau khi đánh',
        why: 'Hồi về nhanh giúp sẵn sàng cho quả tiếp theo.',
        fix: 'Đạp mạnh gót chân trước để đẩy người về; không đứng nhìn cầu sau khi đánh.',
        drill: 'Lên lưới – về giữa sân liên tục 6 lần, bấm giờ — 3 hiệp.',
      },
    ],
  },

  drive: {
    name: 'Tạt cầu',
    desc: 'Cú đánh ngang tầm vai, nhanh và phẳng, thuận tay hoặc trái tay.',
    defaultView: 'front',
    event: 'swing',
    minSpeed: 2.5,
    minGap: 0.4,
    prep: [-0.45, -0.08],
    contact: [-0.08, 0.08],
    finish: [0.08, 0.45],
    keyOffsets: { prep: -0.2, contact: 0, finish: 0.2 },
    tips: [
      'Đặt điện thoại trước mặt hoặc sau lưng người chơi, cao ngang ngực, cách 3–6 m.',
      'Người chơi nên chiếm ít nhất 1/2 chiều cao khung hình (đứng gần hoặc zoom).',
      'Có thể quay cả loạt tạt liên tục — ứng dụng tự tách từng cú.',
    ],
    criteria: [
      {
        id: 'd_stance', name: 'Chân rộng, vững', views: ['front', 'back'], weight: 0.75,
        fmt: 'cm', better: 'higher', good: 0.8, ok: 0.6,
        target: 'Hai bàn chân cách nhau ≥ ~40 cm (rộng hơn vai)',
        why: 'Chân rộng giúp ổn định và đổi hướng nhanh giữa thuận tay – trái tay.',
        fix: 'Đứng rộng hơn vai, trọng tâm ở mũi chân.',
        drill: 'Shadow tạt trái – phải liên tục 30 giây, giữ chân rộng — 4 hiệp.',
      },
      {
        id: 'd_knee', name: 'Hạ trọng tâm (khuỵu gối)', views: ALL, weight: 0.75,
        fmt: 'deg', better: 'lower', good: 160, ok: 170,
        target: 'Góc gối trung bình ≤ 160°',
        why: 'Khuỵu gối giúp phản xạ nhanh và giữ thăng bằng khi tạt.',
        fix: 'Hơi khuỵu gối, đẩy hông ra sau như chuẩn bị ngồi.',
        drill: 'Giữ tư thế sẵn sàng thấp 20 giây, sau đó tạt shadow 10 lần — 4 hiệp.',
      },
      {
        id: 'd_ready', name: 'Vợt sẵn sàng trước ngực', views: ALL, weight: 1,
        fmt: 'cm', better: 'higher', good: 0.6, ok: 0.3,
        target: 'Trước khi đánh, cổ tay cao hơn hông ≥ 30 cm',
        why: 'Vợt cao sẵn giúp đánh sớm, phẳng và nhanh.',
        fix: 'Sau mỗi cú, đưa vợt về ngay trước ngực, đầu vợt hướng lên.',
        drill: 'Tạt đối kháng nhanh với bạn tập, nhắc nhau "vợt lên" — 3 × 1 phút.',
      },
      {
        id: 'd_contact', name: 'Điểm tiếp xúc ngang vai', views: ALL, weight: 1.5,
        fmt: 'cm', better: 'range', good: [-0.35, 0.45], ok: [-0.6, 0.8],
        target: 'Cổ tay trong khoảng thấp hơn vai 18 cm đến cao hơn vai 22 cm',
        why: 'Đánh ngang vai giúp cầu đi phẳng, nhanh, khó đỡ.',
        fix: 'Đón cầu ở trước người ngang vai; nếu cầu thấp thì hạ người bằng chân thay vì hạ vợt.',
        drill: 'Tạt vào mục tiêu dây căng ngang vai cách lưới 30 cm — 3 × 20.',
      },
      {
        id: 'd_elbow', name: 'Khuỷu tay ở tầm ngực', views: ALL, weight: 1,
        fmt: 'cm', better: 'higher', good: -0.55, ok: -0.8,
        target: 'Khuỷu tay không thấp hơn vai quá ~28 cm khi chạm cầu',
        why: 'Khuỷu tay dẫn trước giúp cú tạt gọn và dùng được cẳng tay.',
        fix: 'Nâng khuỷu lên, để khuỷu dẫn đường rồi mới vẩy cẳng tay – cổ tay.',
        drill: 'Tạt với khăn kẹp dưới nách bên tay vợt (không cho rơi xuống thấp) — 3 × 15.',
      },
      {
        id: 'd_compact', name: 'Vung vợt ngắn, gọn', views: ALL, weight: 1,
        fmt: 'cm', better: 'lower', good: 2.0, ok: 3.0,
        target: 'Quãng đường cổ tay trong 0,5 giây quanh lúc chạm cầu ≤ ~100 cm',
        why: 'Tạt cần nhanh: vung dài làm chậm nhịp và khó hồi vợt.',
        fix: 'Dùng lực cẳng tay và ngón tay, giảm biên độ vung từ vai.',
        drill: 'Tạt sát tường cách 1,5 m liên tục — 3 × 30 giây.',
      },
      {
        id: 'd_recover', name: 'Hồi vợt nhanh', views: ALL, weight: 1,
        fmt: 's', better: 'lower', good: 0.25, ok: 0.45,
        target: 'Dừng và thu vợt trong ≤ 0,25 giây sau khi chạm cầu',
        why: 'Hồi nhanh để sẵn sàng cho quả tạt tiếp theo.',
        fix: 'Sau khi chạm cầu, chủ động dừng vợt và đưa về trước ngực.',
        drill: 'Tạt nhiều cầu liên tục (multi-shuttle) nhịp nhanh — 3 × 20 quả.',
      },
      {
        id: 'd_balance', name: 'Thân trên vững', views: ALL, weight: 0.75,
        fmt: 'deg', better: 'lower', good: 15, ok: 25,
        target: 'Thân nghiêng ≤ 15° quanh lúc đánh',
        why: 'Thân vững giúp kiểm soát hướng cầu.',
        fix: 'Giữ đầu và thân ổn định, chỉ tay và vai chuyển động.',
        drill: 'Tạt shadow trước gương, quan sát đầu không lắc — 3 × 20.',
      },
    ],
  },
};

export function gradeOf(c, v) {
  if (v == null || !isFinite(v)) return { status: 'na', score: null };
  let s;
  if (c.better === 'higher') s = v >= c.good ? 'good' : v >= c.ok ? 'ok' : 'bad';
  else if (c.better === 'lower') s = v <= c.good ? 'good' : v <= c.ok ? 'ok' : 'bad';
  else s = (v >= c.good[0] && v <= c.good[1]) ? 'good' : (v >= c.ok[0] && v <= c.ok[1]) ? 'ok' : 'bad';
  return { status: s, score: { good: 100, ok: 60, bad: 20 }[s] };
}

export function fmtValue(c, v) {
  if (v == null || !isFinite(v)) return '—';
  if (c.fmt === 'deg') return `${Math.round(v)}°`;
  if (c.fmt === 's') return `${v.toFixed(2)} s`;
  if (c.fmt === 'pct') return `${Math.round(v * 100)}%`;
  const cm = Math.round(v * CM_PER_T);
  return `${cm > 0 && SIGNED.has(c.id) ? '+' : ''}${cm} cm`;
}

// Các số đo là độ cao tương đối (so với vai/đầu/hông) — hiển thị dấu +/-.
const SIGNED = new Set(['c_offarm', 'c_elbow_up', 'c_contact_high', 'c_follow', 'n_hand_high', 'd_ready', 'd_contact', 'd_elbow']);

export const STATUS_LABEL = { good: 'Tốt', ok: 'Tạm được', bad: 'Cần sửa', na: 'Không đo được' };
