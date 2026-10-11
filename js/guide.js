// ============================================================
//  GUIDE — how-to-play screens, per-form breakdown, per-character
//  playstyle, quick technique palette (hold F), training dojo
// ============================================================
'use strict';

// ---------------- form analysis (generated from data, so always accurate) ----------------
const KIND_INFO = {
  slash: ['斬撃', 'Nhát chém lớn', 'Một nhát chém cung lớn ngay trước mặt.', 'Khi quỷ đứng sát trước mặt.'],
  flip: ['回転斬り', 'Lộn vòng chém', 'Nhảy lộn vòng về phía trước, mỗi vòng là một nhát chém.', 'Áp sát kèm tránh đòn dưới đất.'],
  dashSlash: ['突進斬り', 'Lướt chém', 'Lướt xuyên qua quỷ, BẤT TỬ trong lúc lướt.', 'Áp sát cực nhanh, hoặc lướt xuyên qua đòn của boss để né.'],
  multi: ['連撃', 'Chuỗi chém', 'Chém liên tục nhiều nhát tại chỗ, tiến nhẹ về trước.', 'Khi quỷ đứng yên ra chiêu — dồn sát thương.'],
  spin: ['旋回', 'Xoay chém', 'Xoay vòng chém mọi hướng quanh người.', 'Khi bị vây hoặc quỷ ở sau lưng.'],
  thrust: ['刺突', 'Đâm xa', 'Đâm thẳng một đường dài, tầm xa.', 'Đánh từ tầm trung, an toàn.'],
  multiThrust: ['連突', 'Đâm liên hoàn', 'Nhiều cú đâm nhanh liên tiếp phía trước.', 'Rải độc nhanh lên quỷ.'],
  slam: ['落撃', 'Bổ từ trên', 'Nhảy lên rồi bổ xuống, tạo sóng chấn động trên mặt đất.', 'Sát thương lớn; tiện thể nhảy né đòn quét đất.'],
  rise: ['昇撃', 'Chém bay lên', 'Bay vút lên vừa bay vừa chém.', 'Né sóng đất / đòn quét (Akaza, Kokushibo, Muzan) và phản đòn.'],
  wave: ['飛撃', 'Đòn bay', 'Phóng một đòn bay xa, xuyên qua mọi quỷ trên đường.', 'Đánh từ xa khi không muốn lại gần.'],
  dragon: ['龍', 'Rồng lượn', 'Lao theo đường uốn lượn như rồng, BẤT TỬ, đánh rất nhiều hit.', 'Vượt qua chuỗi đòn của boss mà vẫn gây sát thương lớn.'],
  whip: ['鞭撃', 'Quất xa', 'Lưỡi kiếm vươn dài như roi, quất rất xa.', 'Đánh quỷ đứng xa mà không cần lại gần.'],
  barrage: ['乱撃', 'Rải đòn', 'Nhiều vụ nổ / nhát chém rải ngẫu nhiên phía trước.', 'Đánh quỷ nhỏ và boss cùng lúc.'],
  rain: ['落下', 'Giáng từ trời', 'Vũ khí nặng rơi từ trời xuống ngay chỗ quỷ gần nhất.', 'Sát thương cực lớn, không cần nhắm.'],
  throw: ['投擲', 'Ném', 'Ném vũ khí bay ra rồi quay về tay, trúng cả lượt đi lẫn về.', 'Đánh từ xa.'],
  aoe: ['爆発', 'Nổ diện rộng', 'Nổ quanh mình: thiêu quỷ, XOÁ đạn quanh mình, GIẢI ĐỘC cả đội. Bất tử khi nổ.', 'Khi bị bắn dồn dập hoặc trúng độc (ải Gyutaro).'],
  zigzag: ['稲妻', 'Zigzag', 'Lướt zigzag quanh quỷ nhiều lần, BẤT TỬ suốt chiêu.', 'Né + dồn sát thương cùng lúc.'],
  buff: ['強化', 'Cường hóa', '', ''],
  combo13: ['奥義', 'Tuyệt kỹ', 'Tự động tung liên tiếp 12 thức Hinokami, BẤT TỬ suốt combo.', 'Trận Muzan: mỗi khung hình còn đẩy nhanh thanh bình minh.'],
  normal: ['斬撃', 'Chém thường', '', ''],
};
const BUFF_INFO = {
  evade: ['Ảo ảnh: BẤT TỬ hoàn toàn.', 'Ngay trước khi boss tung chiêu lớn.'],
  sense: ['40% cơ hội chí mạng x1.8 cho mọi đòn.', 'Bật trước rồi xả chuỗi chiêu nhiều hit.'],
  invis: ['Ẩn thân: quỷ mất dấu bạn, đòn kế tiếp x2 sát thương.', 'Bật rồi tung chiêu mạnh nhất.'],
  guard: ['Giảm 70% sát thương nhận vào, xích quay gây sát thương liên tục.', 'Đứng đánh tay đôi với boss.'],
  nagi: ['Mọi đạn, đường chém, đòn cận chiến lọt vào vùng quanh bạn đều bị chém tan.', 'Khi boss tung chiêu diện rộng (Akaza, Kokushibo, Muzan).'],
  slow: ['Quỷ, đạn và đòn của quỷ chậm lại còn 35% tốc độ. TỐN MÁU.', 'Khi boss vào giai đoạn 2 (dưới 50% máu).'],
};
function formInfo(f, st) {
  const k = KIND_INFO[f.kind] || KIND_INFO.slash;
  const hits = f.kind === 'combo13' ? 12 : (f.hits || f.n || 1);
  let how = k[2], when = k[3];
  if (f.kind === 'buff') { const b = BUFF_INFO[f.buff]; how = b[0] + ` Kéo dài ${(f.dur / 60).toFixed(0)} giây.`; when = b[1]; }
  if (f.kind === 'flip' && f.back) how = 'Lộn ngược ra sau (bất tử) rồi chém ngang một nhát cực mạnh.';
  if (f.kind === 'flip' && f.dist >= 250) how = 'Lộn qua đầu ra SAU LƯNG quỷ rồi chém.';
  if (f.kind === 'dashSlash' && f.fast) how = 'Lướt nhanh như chớp xuyên qua quỷ (BẤT TỬ), nửa giây sau nhát chém mới nổ ra trên cả đường lướt.';
  const chips = [];
  if (f.block) chips.push(['防', 'Chặn đạn khi xoay']);
  if (f.poison) chips.push(['毒', `Gây độc +${f.poison}`]);
  if (f.mercy) chips.push(['慈', 'x3 khi quỷ <30% máu']);
  if (f.hpCost) chips.push(['血', `Tốn ${f.hpCost} máu`]);
  if (f.grow) chips.push(['流', 'Mỗi hit +25% sát thương']);
  if (f.burn) chips.push(['炎', 'Thiêu đốt 5 giây']);
  if (['dashSlash', 'dragon', 'zigzag', 'aoe', 'combo13'].includes(f.kind) || f.inv) chips.push(['無', 'Bất tử khi ra chiêu']);
  if (f.big) chips.push(['奥', 'Có cut-in (tuyệt kỹ)']);
  const total = f.dmg ? Math.round(f.dmg * hits) : 0;
  return { kindJp: k[0], kindVn: k[1], how, when, hits, total, chips };
}

// ---------------- per-character playstyle ----------------
const PLAYSTYLE = {
  tanjiro: ['万能型', 'Toàn diện, có 2 bộ hơi thở. Bấm R để đổi: Nước (rẻ hơi, an toàn) ↔ Hinokami (mạnh, tốn hơi). Mở đầu bằng 雫波紋突き hoặc 打ち潮, khi boss ra chiêu dùng 日暈の龍 (bất tử) để vượt qua. Trận Muzan: dùng 拾参ノ型 — bất tử suốt 12 thức và đẩy nhanh bình minh.'],
  nezuko: ['近接・血鬼術', 'Đánh thường bằng cú đá (J). 爆血 nổ diện rộng: thiêu quỷ, xoá đạn quanh mình và giải độc cả đội — cứu tinh ở ải Gyutaro. Máu nhiều, chạy nhanh.'],
  zenitsu: ['速攻', 'Ít thức nhưng nhanh nhất game. 霹靂一閃 lướt xuyên quỷ (bất tử). 六連 / 八連 zigzag quanh boss. 神速 sát thương lớn nhất nhưng tốn máu. 火雷神 là tuyệt kỹ.'],
  inosuke: ['野生・二刀', '11 nanh rất đa dạng. Bật 空間識覚 trước (40% chí mạng trong 10 giây) rồi xả 切細裂き hoặc 乱杭咬み. 思いつきの投げ裂き ném kiếm đánh từ xa.'],
  kanao: ['技巧', '御影梅 xoay chặn đạn. 徒の芍薬 chém 9 nhát liên tục. 彼岸朱眼 làm quỷ chậm còn 35% (tốn máu) — bật khi boss vào giai đoạn 2.'],
  giyu: ['守り・水', 'Bộ Nước giống Tanjiro + 拾壱ノ型 凪: trong 4 giây mọi đòn bay / đường chém / cận chiến lọt vào quanh bạn đều bị chém tan. Bật ngay khi thấy boss gồng chiêu lớn.'],
  rengoku: ['火力', 'Sát thương cao, máu trâu. 盛炎のうねり xoay chặn đạn. 炎虎 phóng hổ lửa bay xa. 玖ノ型 煉獄 là đòn đơn mạnh nhất game (230) — để kết liễu.'],
  shinobu: ['毒', 'Không chém đứt cổ được nên mọi đòn đều gây độc. Độc tích tụ (tối đa 40) làm quỷ mất máu liên tục và giảm hồi máu. Rải 蝶ノ舞 / 複眼六角 rồi lùi ra né, để độc làm việc.'],
  tengen: ['爆発', 'Đòn nổ diện rộng, hợp đánh nhiều quỷ. 響斬無間 xoay nổ liên hồi quanh mình. 鳴弦奏々 rải nổ phía trước. 轟 bổ xuống nổ to.'],
  mitsuri: ['鞭・広範囲', 'Kiếm roi tầm rất xa. 懊悩巡る恋 quét rộng. 恋猫しぐれ mưa nhát chém. 乱れ爪 xoay bán kính lớn nhất game. Đứng xa mà đánh.'],
  muichiro: ['機動・霞', 'Nhanh, linh hoạt. 朧 ẩn thân: quỷ mất dấu, đòn kế tiếp x2. 霞散の飛沫 xoay chặn đạn. 移流斬り lướt chém (bất tử khi lướt).'],
  obanai: ['変則', 'Đòn uốn lượn khó đoán. 狭頭の毒牙 lộn ra sau lưng quỷ. 頸蛇双生 / 蜿蜿長蛇 là rồng rắn bất tử, nhiều hit.'],
  sanemi: ['猛攻', '9 thức gió, nhiều đòn lướt và bổ từ trên. 塵旋風・削ぎ khoan nhiều hit. 黒風烟嵐 chém hất lên. 韋駄天台風 là tuyệt kỹ.'],
  gyomei: ['重量級', 'Máu trâu nhất, chậm nhất. 岩軀の膚 giảm 70% sát thương + xích tự gây sát thương — bật rồi đứng đánh. 瓦輪刑部 thả chùy và rìu từ trời.'],
};

// ---------------- quick palette (hold F) ----------------
function drawPalette() {
  const P = activeP(), st = curStyle(P), forms = st.forms, fi = P.formIdx[P.styleIdx], th = THEMES[st.theme];
  ctx.fillStyle = 'rgba(5,3,10,.72)'; ctx.fillRect(0, 0, W, H);
  const cols = 4, cw = 290, ch = 74, gx = 12;
  const rows = Math.ceil(forms.length / cols);
  const pw = cols * cw + (cols - 1) * gx + 40, ph = rows * (ch + 10) + 110;
  const px = (W - pw) / 2, py = Math.max(20, (H - 132 - ph) / 2);
  panel(px, py, pw, ph, { pattern: P_SEIGAIHA(), patAlpha: 0.05, accent: th.m });
  T('型を選ぶ', px + 24, py + 42, { size: 30, font: DISP, col: '#fff' });
  T('Chọn thức  ·  ' + (st.noZen ? '' : '全集中・') + styleLabel(st) + ' · ' + (STYLE_VN[st.theme] || ''), px + 150, py + 40, { size: 14, col: th.l, font: JPF });
  hints(P.ch.styles.length > 1 ? [['1…]', '選択', 'Bấm phím số'], ['R', '呼吸切替', 'Đổi hơi thở'], ['F', '離す', 'Thả F để đóng']] : [['1…]', '選択', 'Bấm phím số'], ['F', '離す', 'Thả F để đóng']], px + pw - 20, py + 40, 'right');
  forms.forEach((f, i) => {
    const x = px + 20 + (i % cols) * (cw + gx), y = py + 64 + Math.floor(i / cols) * (ch + 10);
    const sel = i === fi, can = P.br >= f.cost;
    if (clickIn(x, y, cw, ch)) { P.formIdx[P.styleIdx] = i; Audio.sfx.select(); }
    ctx.fillStyle = sel ? 'rgba(179,18,46,.85)' : 'rgba(255,255,255,.05)'; roundRect(ctx, x, y, cw, ch, 8); ctx.fill();
    ctx.strokeStyle = sel ? COL.gold2 : 'rgba(217,182,106,.3)'; ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
    keycap(PALETTE_LABELS[i] || '', x + 8, y + 24, { size: 12 });
    seal(x + 8, y + 32, 34, sealText(f, st), { col: can ? COL.crimson : '#555' });
    T((f.kata ? f.kata + ' ' : '') + (f.name || ''), x + 50, y + 26, { size: 18, font: DISP, col: can ? '#fff' : '#888' });
    T(vnName(f), x + 50, y + 46, { size: 12, col: COL.gold2, weight: 600 });
    const inf = formInfo(f, st);
    T(inf.kindJp + ' ' + inf.kindVn + '  ·  ' + f.cost + ' hơi' + (inf.total ? '  ·  ~' + inf.total + ' dmg' : ''), x + 50, y + 64, { size: 11, col: COL.dim });
  });
}

// ---------------- training dojo ----------------
const TRAINING_STAGE = { id: 0, arc: '稽古', arcVn: 'Luyện tập', place: '藤襲山', bg: 'village', team: Object.keys(CHARS), boss: 'dummy', training: 1, intro: [], outro: [] };
function startTraining(charKey, styleIdx, formIdx) {
  startBattle(-2, TRAINING_STAGE);
  G.si = -2; G.banner = null; G.bosses[0].x = 820;
  const ai = Math.max(0, G.team.findIndex(p => p.key === charKey));
  G.ai = ai;
  const P = activeP();
  if (styleIdx !== undefined) { P.styleIdx = styleIdx; P.formIdx[styleIdx] = formIdx || 0; }
  banner('稽古 — 呼吸は無限', 'Luyện tập: hơi thở vô hạn · Giữ F chọn thức nhanh · 1–0 / Tab đổi nhân vật · Esc → M để thoát', 260);
  mode = 'battle'; Audio.setMusic('calm');
}
function drawTrainingHUD() {
  if (!G.S.training) return;
  const x = W - 250, y = 92;
  panel(x, y, 236, 70, { r: 8 });
  T('稽古 · Luyện tập', x + 14, y + 24, { size: 15, font: JPF, col: COL.gold2 });
  T('Sát thương: ' + (G.trainT > 0 ? Math.round(G.trainDmg) : 0), x + 14, y + 44, { size: 13, col: '#fff', weight: 600 });
  T('Số hit: ' + (G.trainT2 > 0 ? G.trainHits : 0), x + 14, y + 61, { size: 13, col: '#fff', weight: 600 });
  T('hơi vô hạn', x + 222, y + 61, { size: 11, col: COL.dim, align: 'right' });
}

// ---------------- move list (技一覧) with per-form details ----------------
let mlForm = 0;
function charForms(ch) { const out = []; ch.styles.forEach((sk, si) => STYLES[sk].forms.forEach((f, fi) => out.push({ f, st: STYLES[sk], si, fi }))); return out; }
function renderMoveList() {
  gt++;
  patternBg('#0d0b14', P_ASANOHA(), 0.03); vignette(0.6);
  screenHeader('技一覧', 'Danh sách thức & cách dùng — theo Kimetsu no Yaiba Wiki', '技', 'A/D 人物 Nhân vật · W/S 型 Thức · Enter 稽古で試す Thử ngay · Esc 戻る');
  const ch = CHARS[CHAR_KEYS[mlIdx]];
  const all = charForms(ch);
  mlForm = clamp(mlForm, 0, all.length - 1);
  // character list
  CHAR_KEYS.forEach((kk, i) => {
    const y = 80 + i * 44, sel = i === mlIdx, c = CHARS[kk];
    if (clickIn(24, y, 262, 40) && mlIdx !== i) { mlIdx = i; mlForm = 0; }
    if (sel) ink(20, y + 2, 262, 38, 'rgba(179,18,46,.9)', 1, i);
    portrait(c.look, 46, y + 21, 15, { key: kk, theme: STYLES[c.styles[0]].theme, ring: 3, active: sel });
    T(c.name, 72, y + 21, { size: 17, font: JPF, col: sel ? '#fff' : '#cfc6da', weight: 600 });
    const cnt = c.styles.reduce((a, s) => a + STYLES[s].forms.length, 0);
    T(c.vn.split(' — ')[0] + ' · ' + cnt + ' thức', 72, y + 35, { size: 10, col: sel ? '#ffe0b0' : COL.dim, weight: 600 });
  });
  const dx = 300, dy = 80, dw = W - dx - 18, dh = H - dy - 14;
  const th0 = THEMES[STYLES[ch.styles[0]].theme];
  panel(dx, dy, dw, dh, { pattern: P_SEIGAIHA(), patAlpha: 0.04, accent: th0.m });
  // left column: character + playstyle
  ctx.save(); ctx.globalAlpha = 0.3; const rg = ctx.createRadialGradient(dx + 120, dy + 470, 10, dx + 120, dy + 470, 200); rg.addColorStop(0, th0.m); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(dx, dy + 250, 250, dh - 250); ctx.restore();
  drawPerson(ctx, ch.look, ch, dx + 125, dy + dh - 30, 1, { t: gt, swing: -0.4 + Math.sin(gt * 0.04) * 0.1 }, 1, 1.35 * (ch.scale || 1));
  T(ch.name, dx + 18, dy + 34, { size: 24, font: DISP, col: '#fff' });
  T(ch.vn.split(' — ')[0] + (ch.vn.includes(' — ') ? ' · ' + ch.vn.split(' — ')[1] : ''), dx + 18, dy + 52, { size: 11, col: COL.gold2, weight: 600 });
  const ps = PLAYSTYLE[ch.key];
  if (ps) {
    seal(dx + 18, dy + 64, 30, '型');
    T(ps[0] + ' · Lối chơi', dx + 56, dy + 84, { size: 14, font: JPF, col: '#fff' });
    let yy = dy + 112;
    wrap(ps[1], 228, 12, UIF).forEach(l => { T(l, dx + 18, yy, { size: 12, col: '#d8d0e4' }); yy += 16; });
    // canon strengths / weaknesses + stat bars
    yy += 6;
    if (ch.pros) wrap('強 ' + ch.pros, 228, 11, UIF).forEach(l => { T(l, dx + 18, yy, { size: 11, col: '#9fe0a0', weight: 600 }); yy += 14; });
    if (ch.cons) wrap('弱 ' + ch.cons, 228, 11, UIF).forEach(l => { T(l, dx + 18, yy, { size: 11, col: '#ff9a9a', weight: 600 }); yy += 14; });
    yy += 4;
    const bars = [['体', 'Máu', ch.hp / 380], ['攻', 'Công', ((ch.atk || 1) - 0.6) / 0.7], ['守', 'Thủ', (1.35 - (ch.def || 1)) / 0.55], ['速', 'Tốc', (ch.speed - 4.6) / 2.2], ['息', 'Hơi', (ch.br / 130) * 0.6 + ((ch.brRegen || 1) - 0.8) ]];
    bars.forEach(([jp, vn, v]) => {
      v = clamp(v, 0.05, 1);
      T(jp + ' ' + vn, dx + 18, yy + 9, { size: 10, col: COL.dim, weight: 600 });
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(dx + 70, yy + 2, 160, 7);
      ctx.fillStyle = th0.m; ctx.fillRect(dx + 70, yy + 2, 160 * v, 7);
      yy += 12;
    });
  }
  // form list
  const lx = dx + 262, lw = dw - 262 - 14;
  const two = ch.styles.length > 1, colW = two ? lw / 2 : lw;
  const listH = dh - 190;
  let idx = 0;
  ch.styles.forEach((sk, si) => {
    const st = STYLES[sk], th = THEMES[st.theme], x = lx + si * colW;
    let y = dy + 16;
    ink(x, y, colW - 34, 34, shade(th.d, -30), 0.95, 2);
    const sw = T(st.jp, x + 12, y + 24, { size: 20, font: DISP, col: th.l });
    T((STYLE_VN[st.theme] || '') + ' · ' + st.forms.length + (st.theme === 'blood' ? ' thuật' : ' thức') + (two ? (si ? '  [R]' : '') : ''), x + 22 + sw, y + 22, { size: 11, col: '#fff', weight: 600 });
    y += 44;
    const rowH = Math.min(30, (listH - 44) / st.forms.length);
    st.forms.forEach(f => {
      const myIdx = idx++, sel = myIdx === mlForm;
      if (clickIn(x, y, colW - 10, rowH)) mlForm = myIdx;
      if (sel) { ctx.fillStyle = 'rgba(179,18,46,.75)'; roundRect(ctx, x + 2, y - 1, colW - 14, rowH - 1, 5); ctx.fill(); }
      seal(x + 6, y + (rowH - Math.min(22, rowH - 6)) / 2 - 1, Math.min(22, rowH - 6), sealText(f, st), { col: sel ? '#1a0a10' : shade(th.d, -10) });
      T((f.kata ? f.kata + ' ' : '') + (f.name || ''), x + 34, y + rowH / 2 + 5, { size: 15, font: JPF, col: '#fff', weight: 600 });
      T(vnName(f), x + colW - 18, y + rowH / 2 + 4, { size: 10, col: sel ? '#ffe0b0' : COL.dim, align: 'right' });
      y += rowH;
    });
  });
  // detail panel
  const cur = all[mlForm], f = cur.f, st = cur.st, th = THEMES[st.theme], inf = formInfo(f, st);
  const by = dy + dh - 168, bx = lx, bw = lw;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(ctx, bx, by, bw, 156, 10); ctx.fill();
  ctx.strokeStyle = th.m; ctx.lineWidth = 1.5; ctx.stroke();
  seal(bx + 12, by + 14, 58, sealText(f, st), { rot: -0.05 });
  T((f.kata ? f.kata + '　' : '') + (f.name || ''), bx + 82, by + 38, { size: 26, font: DISP, col: '#fff', glow: th.m, glowB: 8 });
  T(f.vn, bx + 84, by + 58, { size: 12, col: COL.gold2, weight: 600 });
  T((st.noZen ? '' : '全集中・') + st.jp + ' · ' + (f.kana || ''), bx + 84, by + 74, { size: 11, col: COL.dim, font: JPF });
  // stats
  const sx = bx + bw - 250;
  const stats = [['種類', inf.kindVn, inf.kindJp], ['呼吸', f.cost + ' hơi thở', ''], ['威力', inf.total ? '~' + inf.total + ' (' + inf.hits + ' hit)' : '—', '']];
  stats.forEach(([jp, v, j2], i) => { T(jp, sx, by + 26 + i * 20, { size: 13, font: JPF, col: COL.dim }); T(v + (j2 ? ' · ' + j2 : ''), sx + 44, by + 26 + i * 20, { size: 13, col: '#fff', weight: 600, font: j2 ? JPF : UIF }); });
  // chips
  let cx = bx + 84;
  inf.chips.forEach(([k, v]) => { const w = measure(k + ' ' + v, 11, JPF) + 14; if (cx + w > sx - 10) return; ctx.fillStyle = 'rgba(217,182,106,.15)'; roundRect(ctx, cx, by + 82, w, 18, 9); ctx.fill(); ctx.strokeStyle = COL.gold; ctx.lineWidth = 1; ctx.stroke(); T(k + ' ' + v, cx + 7, by + 95, { size: 11, font: JPF, col: COL.gold2 }); cx += w + 6; });
  T('使い方 · Cách dùng:', bx + 14, by + 122, { size: 12, col: th.l, font: JPF, weight: 600 });
  T(inf.how, bx + 140, by + 122, { size: 12, col: '#eee' });
  T('使い所 · Khi nào dùng:', bx + 14, by + 142, { size: 12, col: th.l, font: JPF, weight: 600 });
  T(inf.when, bx + 160, by + 142, { size: 12, col: '#eee' });
  // input
  if (pressed('KeyD', 'ArrowRight')) { mlIdx = (mlIdx + 1) % CHAR_KEYS.length; mlForm = 0; Audio.sfx.select(); }
  if (pressed('KeyA', 'ArrowLeft')) { mlIdx = (mlIdx - 1 + CHAR_KEYS.length) % CHAR_KEYS.length; mlForm = 0; Audio.sfx.select(); }
  if (pressed('KeyS', 'ArrowDown')) { mlForm = (mlForm + 1) % all.length; Audio.sfx.select(); }
  if (pressed('KeyW', 'ArrowUp')) { mlForm = (mlForm - 1 + all.length) % all.length; Audio.sfx.select(); }
  if (Input.wheel) { mlForm = (mlForm + Math.sign(Input.wheel) + all.length) % all.length; Input.wheel = 0; }
  if (pressed('Enter', 'KeyK')) { const c2 = all[mlForm]; startTraining(ch.key, c2.si, c2.fi); }
  if (pressed('Escape')) mode = 'title';
}

// ---------------- how-to-play (遊び方) ----------------
let guidePage = 0, guideReturn = 'title';
const GUIDE_PAGES = [
  {
    jp: '基本操作', vn: 'Điều khiển cơ bản', seal: '操',
    rows: [
      ['WASD · Space', '移動', 'Đi 8 hướng (W/S: vào sâu / ra gần) — bước ngang để né vạch chém · Space: nhảy né sóng đất / dải "跳べ"'],
      ['Shift', '回避', 'Lướt né theo hướng đi. Lướt sát lúc trúng đòn = 見切り: chậm thời gian, hồi hơi, thức sau tốn nửa hơi'],
      ['G', '弾き', 'Chém bật: ĐÁNH BẬT đạn/huyết thuật bay về phía quỷ, hoặc gạt đòn đánh của quỷ — đòn kế tiếp chắc chắn chí mạng'],
      ['J / Chuột trái', '斬撃', 'Chém, GIỮ để tự ra combo liên hoàn — tự quay và áp sát quỷ gần nhất. Bấm sớm vẫn ăn (đệm phím)'],
      ['1…0 - = [ ]', '技', 'Tung THẲNG thức số đó (dải số phía trên khung thức) — không cần chọn trước'],
      ['K / Chuột phải', '技', 'Tung THỨC đang chọn (chọn bằng Q / E / lăn chuột); hủy được đòn chém để ra thức ngay'],
      ['F (giữ)', '型を選ぶ', 'Mở bảng tất cả thức, thời gian dừng lại, bấm số 1…0 - = [ ] chọn thẳng'],
      ['R', '呼吸切替', 'Đổi bộ hơi thở (chỉ Tanjiro: Nước ↔ Hinokami)'],
      ['L (giữ)', '全集中', 'Đứng yên hít thở: hồi thanh hơi thở rất nhanh'],
      ['Tab / C', '交代', 'Đổi nhân vật trong đội (hoặc bấm vào chân dung)'],
      ['Esc', '一時停止', 'Tạm dừng · H: mở hướng dẫn · M: thoát'],
    ],
  },
  {
    jp: '呼吸と型', vn: 'Hơi thở & cách dùng thức', seal: '呼',
    text: [
      ['呼吸ゲージ', 'Thanh HƠI THỞ (xanh, dưới thanh máu) là "mana". Mỗi thức tốn một lượng hơi ghi ở góc phải khung dưới. Không đủ hơi thì tên thức chuyển xám, bấm K sẽ hiện "Hết hơi!".'],
      ['回復', 'Hồi hơi: tự hồi chậm theo thời gian · mỗi đòn đánh trúng +1,5 · giữ L (全集中) hồi nhanh gấp ~8 lần · nhân vật đang nghỉ trong đội cũng hồi.'],
      ['流れ', 'Nhịp chơi cơ bản: chém J vài nhát (hồi hơi) → tung 1–2 thức K → lướt Shift né → giữ L hồi hơi khi boss ở xa → lặp lại.'],
      ['奥義', 'Thức có ấn "奥" là TUYỆT KỸ: có cảnh cut-in, thời gian dừng lại trong lúc diễn, sát thương lớn và tốn nhiều hơi.'],
      ['無敵', 'Nhiều thức có ấn "無" (lướt, rồng, zigzag, nổ, 拾参ノ型) BẤT TỬ khi đang ra chiêu: dùng chúng để xuyên qua đòn của boss.'],
      ['毒・慈', 'Ấn "毒": gây độc, quỷ mất máu liên tục và hồi máu chậm lại. Ấn "慈" (干天の慈雨): x3 sát thương khi quỷ dưới 30% máu, dùng để kết liễu.'],
    ],
  },
  {
    jp: '連携', vn: 'Phối hợp chiến đấu — đừng chỉ spam J', seal: '連',
    text: [
      ['連撃', 'COMBO: mỗi đòn trúng trong vòng 2 giây nối chuỗi, sát thương +1% mỗi bậc (tối đa +50%). ĐỔI CHIÊU liên tục (chém → thức → thức khác) được +2 bậc mỗi lần. Bị trúng đòn = mất chuỗi.'],
      ['見切られた', 'Quỷ ĐỌC ĐÒN: chém thường liên tục 6 nhát mà không xen thức, Thượng/Hạ Huyền sẽ gạt mọi nhát chém thường (chỉ ăn 15%) rồi phản công. Lúc đó hãy tung thức (phím số) hoặc lùi ra.'],
      ['体勢', 'THẾ ĐỨNG: vạch vàng dưới thanh máu boss. Thức đầy vạch nhanh gấp 4 lần chém thường; đỡ đòn và né hoàn hảo cũng làm đầy. Đầy vạch = 隙！ boss choáng 3 giây, nhận +50% sát thương và chí mạng — tung tuyệt kỹ ngay lúc này.'],
      ['弾き', 'CHÉM BẬT (G): một nhát chém nhanh quanh người. Đạn của quỷ (quyền khí, đai, liềm, kim, trăng khuyết…) bay vào vùng chém sẽ bị ĐÁNH BẬT ngược lại vào con quỷ gần nhất (sát thương ×2). Bấm ngay trước khi đòn cận chiến chạm người thì GẠT ĐÒN: hồi hơi, boss mất nhiều thế đứng, đòn kế chắc chắn chí mạng. Hụt thì phải chờ một nhịp.'],
      ['見切り', 'NÉ HOÀN HẢO (Shift sát lúc trúng đòn): thời gian chậm lại gần 1 giây, +25 hơi, thức kế tiếp chỉ tốn nửa hơi.'],
      ['ゲームパッド', 'TAY CẦM: cần trái / D-pad đi · A nhảy · X chém · Y thức · B lướt · L3/R3 chém bật · LB/RB chọn thức · LT bảng thức · RT tụ khí · Back đổi người · Start tạm dừng.'],
      ['流れ', 'Nhịp chơi hay: chém 2–3 nhát → tung thức (đổi chiêu = combo) → nhìn boss gồng chiêu thì đỡ / né hoàn hảo → vạch thế đứng đầy → boss choáng → tuyệt kỹ. Hết hơi thì giữ L hoặc né hoàn hảo để hồi.'],
    ],
  },
  {
    jp: '20以上の型を使う', vn: 'Dùng hết 20+ thức thế nào?', seal: '型',
    text: [
      ['F', 'Cách nhanh nhất: GIỮ F. Bảng tất cả thức hiện ra, thời gian dừng, mỗi thức có số. Bấm số → thả F → bấm K. Ví dụ Tanjiro bộ Hinokami: F + 7 = 日暈の龍, F + ] = 拾参ノ型.'],
      ['R', 'Tanjiro có 24 thức chia 2 bộ: 水の呼吸 (10) và ヒノカミ神楽 (14). Bấm R đổi bộ, Q/E/F chỉ chọn trong bộ đang dùng.'],
      ['技一覧', 'Màn 技一覧 (menu chính) ghi từng thức: loại đòn, hơi, sát thương ước tính, hiệu ứng, CÁCH DÙNG và KHI NÀO DÙNG. Bấm Enter ở một thức để vào luyện tập thử ngay thức đó.'],
      ['稽古', 'Chế độ 稽古 · Luyện tập: bù nhìn rơm không đánh trả, hơi thở vô hạn, có đủ 14 nhân vật (phím 1–0 cho 10 người đầu, Tab để xoay vòng tới cả 14). Có bảng đếm sát thương và số hit để so sánh các thức.'],
      ['組合せ', 'Combo gợi ý: (1) đòn tầm xa (đâm / đòn bay) khi boss ở xa → (2) lướt chém áp sát → (3) chuỗi chém nhiều hit → (4) khi boss gồng chiêu lớn thì dùng thức bất tử hoặc 凪 / 幻日虹.'],
    ],
  },
  {
    jp: '仲間', vn: 'Đội hình & đổi người', seal: '仲',
    text: [
      ['交代', 'Mỗi ải có đội theo đúng cốt truyện anime. Bấm Tab / C (hoặc bấm vào chân dung) để đổi người ngay giữa trận (hồi lại sau ~0,7 giây). Người vào sân được bất tử ngắn.'],
      ['休憩', 'Người đang nghỉ hồi hơi thở và hồi máu chậm: đổi người khi sắp hết máu hoặc hết hơi.'],
      ['戦闘不能', 'Một người hết máu sẽ gục, game tự đổi sang người khác. Cả đội gục là thua.'],
      ['相性', 'Ví dụ cách phối: Shinobu rải độc → đổi Kanao bật 彼岸朱眼 làm chậm → đổi Inosuke 空間識覚 xả đòn chí mạng.'],
    ],
  },
  {
    jp: '鬼の攻撃を読む', vn: 'Đọc đòn của quỷ', seal: '読',
    text: [
      ['予兆', 'Mọi đòn của quỷ đều báo trước. Tên chiêu hiện trên đầu quỷ (vd 破壊殺・羅針) kèm hình báo hiệu:'],
      ['線', 'Đường NÉT ĐỨT nhấp nháy: sắp có nhát chém hoặc sợi tơ dọc theo đường đó → rời khỏi đường.'],
      ['円', 'Vòng tròn đỏ / xanh đang lấp đầy: sắp nổ → ra khỏi vòng.'],
      ['地', 'Elip đỏ trên mặt đất: tay / cây / gai sắp mọc lên → tránh chỗ đó.'],
      ['跳', 'Dải ĐỎ ngang mặt đất ghi "跳べ! NHẢY!": đòn quét toàn màn hình → nhảy (W) hoặc dùng thức bay lên.'],
      ['回避', 'Lướt né (Shift) và các thức bất tử xuyên qua được mọi đòn. 凪 của Giyu chém tan đạn và đường chém.'],
    ],
  },
  {
    jp: '各話の攻略', vn: 'Mẹo từng ải', seal: '攻',
    text: [
      ['第一話〜五話', 'Hand Demon, Susamaru, Kyogai, Rui, Enmu: làm quen điều khiển. Rui: lồng tơ 刻糸牢 co lại, chạy RA khỏi vòng. Enmu: bị ru ngủ thì bấm J liên tục để tỉnh.'],
      ['第六話 猗窩座', 'Không giết được Akaza. Cầm cự tới BÌNH MINH (thanh 夜明け); đánh trúng làm bình minh tới nhanh hơn.'],
      ['第七話 遊郭', 'Phải hạ CẢ Daki và Gyutaro trong 4 giây, nếu không chúng hồi sinh 50%. Hạ một con xuống thấp rồi dồn con kia. Trúng độc thì dùng 爆血 của Nezuko.'],
      ['第八・九話', 'Gyokko dịch chuyển, dùng đòn tầm xa. Hantengu: hạ máu xong thì con quỷ nhỏ 「恨」 chạy trốn, đuổi theo chém nó.'],
      ['第十〜十二話', 'Douma: Shinobu rải độc, độc làm hắn hồi máu chậm. Akaza lần 2 hồi sinh 1 lần. Kokushibo: đường trăng rất nhiều, dùng Shift / 凪.'],
      ['最終話 無惨', 'Cầm cự tới BÌNH MINH (120 giây). 拾参ノ型 của Tanjiro (F + ]) bất tử và đẩy nhanh bình minh. Dải đỏ thì nhảy, xúc tu gai thì lướt né.'],
    ],
  },
];
function openGuide(from) { guideReturn = from || 'title'; guidePage = 0; mode = 'guide'; }
function renderGuide() {
  gt++;
  if (guideReturn === 'battle' && G && G.S) { drawBackground(ctx, G.S.bg, G); ctx.fillStyle = 'rgba(5,3,10,.85)'; ctx.fillRect(0, 0, W, H); }
  else { patternBg('#0d0b14', P_SEIGAIHA(), 0.035); vignette(0.6); }
  screenHeader('遊び方', 'Hướng dẫn chơi', '遊', `${guidePage + 1} / ${GUIDE_PAGES.length}`);
  // tabs
  let tx = 30;
  GUIDE_PAGES.forEach((pg, i) => {
    const w = measure(pg.jp, 14, JPF) + 26, sel = i === guidePage;
    if (clickIn(tx, 80, w, 30)) guidePage = i;
    ctx.fillStyle = sel ? COL.crimson : 'rgba(255,255,255,.06)'; roundRect(ctx, tx, 80, w, 30, 15); ctx.fill();
    ctx.strokeStyle = sel ? COL.gold2 : 'rgba(217,182,106,.35)'; ctx.lineWidth = 1; ctx.stroke();
    T(pg.jp, tx + w / 2, 100, { size: 14, font: JPF, col: '#fff', align: 'center' }); tx += w + 8;
  });
  const pg = GUIDE_PAGES[guidePage];
  panel(30, 124, W - 60, H - 184, { pattern: P_ASANOHA(), patAlpha: 0.04 });
  seal(52, 144, 56, pg.seal, { rot: -0.05 });
  bi(pg.jp, pg.vn, 124, 176, { size: 32, font: DISP, vsize: 15, vcol: COL.gold2, gap: 24 });
  if (pg.rows) pg.rows.forEach(([k, jp, vn], i) => {
    const y = 250 + i * 36;
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect(60, y - 25, W - 120, 34); }
    keycap(k, 76, y, { size: 14 }); T(jp, 270, y - 2, { size: 19, font: JPF, col: '#fff', weight: 600 }); T(vn, 420, y - 2, { size: 15, col: '#d8d0e0' });
  });
  if (pg.text) {
    let y = 250;
    pg.text.forEach(([k, v]) => {
      seal(60, y - 22, 30, [...k][0], { col: COL.crimson });
      T(k, 102, y - 2, { size: 16, font: JPF, col: COL.gold2, weight: 700 });
      const lines = wrap(v, W - 300, 15, UIF);
      lines.forEach((l, i) => T(l, 250, y - 2 + i * 21, { size: 15, col: '#e8e2f0' }));
      y += Math.max(34, lines.length * 21 + 14);
    });
  }
  hints([['A/D', 'ページ', 'Trang'], ['Esc', '戻る', 'Quay lại']], W / 2, H - 24, 'center');
  if (pressed('KeyD', 'ArrowRight', 'Enter')) { guidePage = (guidePage + 1) % GUIDE_PAGES.length; Audio.sfx.select(); }
  if (pressed('KeyA', 'ArrowLeft')) { guidePage = (guidePage - 1 + GUIDE_PAGES.length) % GUIDE_PAGES.length; Audio.sfx.select(); }
  if (pressed('Escape')) { mode = guideReturn; if (guideReturn === 'battle' && G) G.paused = true; }
}
