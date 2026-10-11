// ============================================================
//  鬼滅の刃 — 全集中 : DATA
//  Forms verified against kimetsu-no-yaiba.fandom.com (canon only, no game-exclusive moves)
// ============================================================
'use strict';

const KATA = {
  1: ['壱ノ型', 'いちのかた'], 2: ['弐ノ型', 'にのかた'], 3: ['参ノ型', 'さんのかた'], 4: ['肆ノ型', 'しのかた'],
  5: ['伍ノ型', 'ごのかた'], 6: ['陸ノ型', 'ろくのかた'], 7: ['漆ノ型', 'しちのかた'], 8: ['捌ノ型', 'はちのかた'],
  9: ['玖ノ型', 'くのかた'], 10: ['拾ノ型', 'じゅうのかた'], 11: ['拾壱ノ型', 'じゅういちのかた'],
};
const KIBA = {
  1: ['壱ノ牙', 'いちのきば'], 2: ['弐ノ牙', 'にのきば'], 3: ['参ノ牙', 'さんのきば'], 4: ['肆ノ牙', 'しのきば'],
  5: ['伍ノ牙', 'ごのきば'], 6: ['陸ノ牙', 'ろくのきば'], 9: ['玖ノ牙', 'くのきば'], 10: ['拾ノ牙', 'じゅうのきば'],
};

// form(kataLabel[jp,kana] | null, name, kana, vn, kind, params)
function F(k, name, kana, vn, kind, p) {
  return Object.assign({ kata: k ? k[0] : '', kataKana: k ? k[1] : '', name, kana, vn, kind }, p || {});
}

// ---------------- BREATHING STYLES ----------------
const STYLES = {
  water: {
    jp: '水の呼吸', kana: 'みずのこきゅう', theme: 'water', forms: [
      F(KATA[1], '水面斬り', 'みなもぎり', 'Thủy Diện Trảm — chém ngang mặt nước', 'slash', { dmg: 60, cost: 14, r: 150, a0: -0.25, a1: 0.25, flat: true, w: 34 }),
      F(KATA[2], '水車', 'みずぐるま', 'Thủy Xa — xoay tròn dọc như guồng nước', 'flip', { dmg: 26, cost: 16, hits: 3, dist: 160 }),
      F(KATA[3], '流流舞い', 'りゅうりゅうまい', 'Lưu Lưu Vũ — lướt uốn lượn chém liên tục', 'dashSlash', { dmg: 22, cost: 18, dist: 380, hits: 5, weave: 1 }),
      F(KATA[4], '打ち潮', 'うちしお', 'Đả Triều — chuỗi chém như sóng vỗ', 'multi', { dmg: 20, cost: 16, n: 4, r: 140 }),
      F(KATA[5], '干天の慈雨', 'かんてんのじう', 'Can Thiên Từ Vũ — nhát chém nhân từ (x3 khi địch yếu)', 'slash', { dmg: 45, cost: 18, r: 130, a0: -1.6, a1: 0.3, mercy: 1, w: 20 }),
      F(KATA[6], 'ねじれ渦', 'ねじれうず', 'Nữu Oa — xoáy nước vặn mình', 'spin', { dmg: 18, cost: 20, hits: 5, r: 160 }),
      F(KATA[7], '雫波紋突き', 'しずくはもんづき', 'Đích Ba Văn Đột — đâm nhanh nhất, gợn sóng', 'thrust', { dmg: 55, cost: 12, len: 300 }),
      F(KATA[8], '滝壷', 'たきつぼ', 'Lung Hồ — bổ xuống như thác đổ', 'slam', { dmg: 70, cost: 22, r: 200 }),
      F(KATA[9], '水流飛沫・乱', 'すいりゅうしぶき・らん', 'Thủy Lưu Phi Mạt · Loạn — chạm đất tối thiểu, lướt liên tục mà chém', 'dashSlash', { dmg: 16, cost: 18, dist: 460, hits: 6, inv: 1, hop: 1 }),
      F(KATA[10], '生生流転', 'せいせいるてん', 'Sinh Sinh Lưu Chuyển — rồng nước, càng xoay càng mạnh', 'dragon', { dmg: 16, cost: 34, hits: 9, grow: 1, big: 1 }),
    ]
  },
  water11: { // Giyu
    jp: '水の呼吸', kana: 'みずのこきゅう', theme: 'water', forms: null /* filled below */
  },
  sun: {
    jp: 'ヒノカミ神楽', kana: 'ひのかみかぐら', theme: 'sun', noZen: 1, forms: [
      F(null, '円舞', 'えんぶ', 'Viên Vũ — nhát chém vòng cung từ trên xuống', 'slash', { dmg: 75, cost: 20, r: 170, a0: -1.9, a1: 0.9, w: 40 }),
      F(null, '円舞一閃', 'えんぶいっせん', 'Viên Vũ Nhất Thiểm — kết hợp Lôi + Nhật (Tanjiro tự sáng tạo)', 'dashSlash', { dmg: 90, cost: 26, dist: 520, hits: 1, fast: 1, big: 1 }),
      F(null, '碧羅の天', 'へきらのてん', 'Bích La Thiên — xoay người chém 360°', 'spin', { dmg: 26, cost: 22, hits: 4, r: 180 }),
      F(null, '烈日紅鏡', 'れつじつこうきょう', 'Liệt Nhật Hồng Kính — hai nhát chém ngang', 'multi', { dmg: 38, cost: 22, n: 2, r: 170, flat: 1 }),
      F(null, '灼骨炎陽', 'しゃっこつえんよう', 'Chước Cốt Viêm Dương — xoắn ốc phía trước, chặn đòn', 'spin', { dmg: 22, cost: 22, hits: 4, r: 150, front: 1, block: 1 }),
      F(null, '陽華突', 'ようかとつ', 'Dương Hoa Đột — đâm hất lên', 'thrust', { dmg: 70, cost: 20, len: 260, up: 1 }),
      F(null, '日暈の龍 頭舞い', 'にちうんのりゅう かぶりまい', 'Nhật Vựng Long · Đầu Vũ — rồng lửa mặt trời', 'dragon', { dmg: 24, cost: 38, hits: 8, big: 1 }),
      F(null, '斜陽転身', 'しゃようてんしん', 'Tà Dương Chuyển Thân — lộn ngược chém ngang cổ', 'flip', { dmg: 50, cost: 20, hits: 1, dist: 120, back: 1 }),
      F(null, '飛輪陽炎', 'ひりんかげろう', 'Phi Luân Dương Viêm — lưỡi kiếm ẩn trong ảo nhiệt', 'slash', { dmg: 65, cost: 22, r: 240, a0: -0.5, a1: 0.5, flat: 1, haze: 1, w: 30 }),
      F(null, '輝輝恩光', 'ききおんこう', 'Huy Huy Ân Quang — xoắn ốc bay lên', 'rise', { dmg: 22, cost: 22, hits: 4 }),
      F(null, '火車', 'かしゃ', 'Hỏa Xa — nhảy lộn vòng, chém dọc từ trên xuống', 'flip', { dmg: 32, cost: 20, hits: 2, dist: 200 }),
      F(null, '幻日虹', 'げんにちこう', 'Huyễn Nhật Hồng — ảo ảnh né tránh', 'buff', { cost: 16, buff: 'evade', dur: 120 }),
      F(null, '炎舞', 'えんぶ', 'Viêm Vũ — hai nhát dọc rồi ngang', 'multi', { dmg: 40, cost: 20, n: 2, r: 160 }),
      F([ '拾参ノ型', 'じゅうさんのかた' ], '', '', 'Thập Tam Hình — nối liền 12 thức không ngừng nghỉ', 'combo13', { dmg: 20, cost: 60, big: 1 }),
    ]
  },
  thunder: {
    jp: '雷の呼吸', kana: 'かみなりのこきゅう', theme: 'thunder', forms: [
      F(KATA[1], '霹靂一閃', 'へきれきいっせん', 'Phích Lịch Nhất Thiểm — rút kiếm sấm sét', 'dashSlash', { dmg: 85, cost: 18, dist: 560, hits: 1, fast: 1 }),
      F(KATA[1], '霹靂一閃・六連', 'へきれきいっせん・ろくれん', 'Phích Lịch Nhất Thiểm · Lục Liên — 6 lần liên tiếp', 'zigzag', { dmg: 32, cost: 28, n: 6 }),
      F(KATA[1], '霹靂一閃・八連', 'へきれきいっせん・はちれん', 'Phích Lịch Nhất Thiểm · Bát Liên — 8 lần liên tiếp', 'zigzag', { dmg: 30, cost: 34, n: 8 }),
      F(KATA[1], '霹靂一閃・神速', 'へきれきいっせん・しんそく', 'Phích Lịch Nhất Thiểm · Thần Tốc — tốn máu (chân chịu tải)', 'dashSlash', { dmg: 170, cost: 30, dist: 700, hits: 1, fast: 2, hpCost: 30, big: 1 }),
      F(KATA[7], '火雷神', 'ほのいかづちのかみ', 'Hỏa Lôi Thần — thức tự sáng tạo, rồng sấm', 'dragon', { dmg: 60, cost: 50, hits: 4, fast: 1, big: 1 }),
    ]
  },
  beast: {
    jp: '獣の呼吸', kana: 'けだもののこきゅう', theme: 'beast', forms: [
      F(KIBA[1], '穿ち抜き', 'うがちぬき', 'Xuyên Bạt — đâm song kiếm', 'thrust', { dmg: 55, cost: 14, len: 240, twin: 1 }),
      F(KIBA[2], '切り裂き', 'きりさき', 'Thiết Liệt — chém chữ X', 'multi', { dmg: 30, cost: 14, n: 2, r: 130, cross: 1 }),
      F(KIBA[3], '喰い裂き', 'くいざき', 'Thực Liệt — kẹp cắt như hàm răng', 'multi', { dmg: 34, cost: 16, n: 2, r: 130, bite: 1 }),
      F(KIBA[4], '切細裂き', 'きりこまざき', 'Thiết Tế Liệt — băm vụn', 'multi', { dmg: 12, cost: 18, n: 8, r: 120 }),
      F(KIBA[5], '狂い裂き', 'くるいざき', 'Cuồng Liệt — chém điên loạn xung quanh', 'spin', { dmg: 16, cost: 20, hits: 6, r: 170, jag: 1 }),
      F(KIBA[6], '乱杭咬み', 'らんぐいがみ', 'Loạn Hàng Giảo — cưa răng cưa', 'multi', { dmg: 14, cost: 18, n: 6, r: 110, saw: 1 }),
      F(KATA[7], '空間識覚', 'くうかんしきかく', 'Không Gian Thức Giác — cảm nhận mọi thứ (chí mạng)', 'buff', { cost: 18, buff: 'sense', dur: 600 }),
      F(KATA[8], '爆裂猛進', 'ばくれつもうしん', 'Bạo Liệt Mãnh Tiến — húc thẳng', 'dashSlash', { dmg: 40, cost: 18, dist: 420, hits: 2, body: 1 }),
      F(KIBA[9], '伸・うねり裂き', 'しん・うねりざき', 'Thân · Uốn Lượn Liệt — vặn khớp vươn dài', 'whip', { dmg: 50, cost: 18, len: 340 }),
      F(KIBA[10], '円転旋牙', 'えんてんせんが', 'Viên Chuyển Toàn Nha — xoay tròn như lốc', 'spin', { dmg: 20, cost: 22, hits: 5, r: 160 }),
      F(null, '思いつきの投げ裂き', 'おもいつきのなげさき', 'Ném Liệt Ngẫu Hứng — ném kiếm răng cưa', 'throw', { dmg: 45, cost: 16 }),
    ]
  },
  flame: {
    jp: '炎の呼吸', kana: 'ほのおのこきゅう', theme: 'flame', forms: [
      F(KATA[1], '不知火', 'しらぬい', 'Bất Tri Hỏa — lao tới chém', 'dashSlash', { dmg: 70, cost: 18, dist: 440, hits: 1 }),
      F(KATA[2], '昇り炎天', 'のぼりえんてん', 'Thăng Viêm Thiên — chém hất lên', 'rise', { dmg: 60, cost: 18, hits: 1, arc: 1 }),
      F(KATA[3], '気炎万象', 'きえんばんしょう', 'Khí Viêm Vạn Tượng — bổ xuống vòng cung', 'slash', { dmg: 75, cost: 20, r: 180, a0: -2.0, a1: 1.2, w: 44 }),
      F(KATA[4], '盛炎のうねり', 'せいえんのうねり', 'Thịnh Viêm Uốn Lượn — xoáy lửa chặn mọi đòn', 'spin', { dmg: 20, cost: 20, hits: 5, r: 170, front: 1, block: 1 }),
      F(KATA[5], '炎虎', 'えんこ', 'Viêm Hổ — hổ lửa vồ mồi', 'wave', { dmg: 85, cost: 26, size: 120, speed: 14, tiger: 1, big: 1 }),
      F(KATA[9], '煉獄', 'れんごく', 'Luyện Ngục — tuyệt kỹ thiêu rụi', 'dashSlash', { dmg: 230, cost: 55, dist: 600, hits: 1, fast: 1, huge: 1, big: 1 }),
    ]
  },
  insect: {
    jp: '蟲の呼吸', kana: 'むしのこきゅう', theme: 'insect', poison: 1, forms: [
      F(['蝶ノ舞', 'ちょうのまい'], '戯れ', 'たわむれ', 'Điệp Vũ · Hí — múa bướm, nhiều nhát độc', 'multiThrust', { dmg: 8, cost: 14, n: 5, poison: 3 }),
      F(['蜂牙ノ舞', 'ほうがのまい'], '真靡き', 'まなびき', 'Phong Nha Vũ · Chân Mỹ — đâm như ong', 'thrust', { dmg: 20, cost: 12, len: 330, poison: 4, fast: 1 }),
      F(['虻咬ノ舞', 'もうかのまい'], '切裂の誘い', 'せっさくのさそい', 'Manh Giảo Vũ · Thiết Liệt Dụ — lướt chéo dụ địch', 'dashSlash', { dmg: 16, cost: 14, dist: 300, hits: 2, poison: 3 }),
      F(['蜻蛉ノ舞', 'せいれいのまい'], '複眼六角', 'ふくがんろっかく', 'Tinh Linh Vũ · Phức Nhãn Lục Giác — 6 cú đâm', 'multiThrust', { dmg: 10, cost: 20, n: 6, poison: 5, hex: 1 }),
      F(['蜈蚣ノ舞', 'ごこうのまい'], '百足蛇腹', 'ひゃくそくじゃばら', 'Ngô Công Vũ · Bách Túc Xà Phúc — lướt zigzag', 'zigzag', { dmg: 14, cost: 24, n: 5, poison: 3 }),
    ]
  },
  love: {
    jp: '恋の呼吸', kana: 'こいのこきゅう', theme: 'love', forms: [
      F(KATA[1], '初恋のわななき', 'はつこいのわななき', 'Sơ Luyến Run Rẩy — chém liên hoàn', 'multi', { dmg: 12, cost: 16, n: 8, r: 200, whipy: 1 }),
      F(KATA[2], '懊悩巡る恋', 'おうのうめぐるこい', 'Áo Não Tuần Luyến — roi kiếm quét rộng', 'whip', { dmg: 45, cost: 18, len: 360, sweep: 1 }),
      F(KATA[3], '恋猫しぐれ', 'こいねこしぐれ', 'Luyến Miêu Thời Vũ — mưa nhát chém', 'barrage', { dmg: 10, cost: 20, n: 10 }),
      F(KATA[5], '揺らめく恋情・乱れ爪', 'ゆらめくれんじょう・みだれづめ', 'Dao Động Luyến Tình · Loạn Trảo', 'spin', { dmg: 18, cost: 22, hits: 6, r: 230, whipy: 1 }),
      F(KATA[6], '猫足恋風', 'ねこあしこいかぜ', 'Miêu Túc Luyến Phong — nhảy vụt quất lên', 'rise', { dmg: 22, cost: 20, hits: 4, arc: 1 }),
    ]
  },
  mist: {
    jp: '霞の呼吸', kana: 'かすみのこきゅう', theme: 'mist', forms: [
      F(KATA[1], '垂天遠霞', 'すいてんとおがすみ', 'Thùy Thiên Viễn Hà — đâm xuyên mây', 'thrust', { dmg: 60, cost: 14, len: 320 }),
      F(KATA[2], '八重霞', 'やえかすみ', 'Bát Trùng Hà — tám tầng sương', 'multi', { dmg: 12, cost: 18, n: 8, r: 150 }),
      F(KATA[3], '霞散の飛沫', 'かさんのしぶき', 'Hà Tán Phi Mạt — xoay tán sương, chặn đòn', 'spin', { dmg: 18, cost: 18, hits: 4, r: 160, block: 1 }),
      F(KATA[4], '移流斬り', 'いりゅうぎり', 'Di Lưu Trảm — lướt chém thấp', 'dashSlash', { dmg: 55, cost: 16, dist: 400, hits: 1 }),
      F(KATA[5], '霞雲の海', 'かうんのうみ', 'Hà Vân Hải — biển mây chém', 'multi', { dmg: 16, cost: 22, n: 6, r: 200, wide: 1 }),
      F(KATA[6], '月の霞消', 'つきのかしょう', 'Nguyệt Hà Tiêu — chém tỏa từ trên không', 'rise', { dmg: 20, cost: 22, hits: 5, fan: 1 }),
      F(KATA[7], '朧', 'おぼろ', 'Lung — ẩn thân trong sương, phản đòn x2', 'buff', { cost: 22, buff: 'invis', dur: 240 }),
    ]
  },
  sound: {
    jp: '音の呼吸', kana: 'おとのこきゅう', theme: 'sound', forms: [
      F(KATA[1], '轟', 'とどろき', 'Oanh — nổ tung khi bổ', 'slam', { dmg: 80, cost: 20, r: 230, boom: 1 }),
      F(KATA[4], '響斬無間', 'きょうざんむけん', 'Hưởng Trảm Vô Gian — xoay đôi đao, nổ liên hồi', 'spin', { dmg: 20, cost: 26, hits: 8, r: 190, boom: 1, big: 1 }),
      F(KATA[5], '鳴弦奏々', 'めいげんそうそう', 'Minh Huyền Tấu Tấu — tấu nhạc nổ tiến về trước', 'barrage', { dmg: 24, cost: 24, n: 7, boom: 1 }),
    ]
  },
  serpent: {
    jp: '蛇の呼吸', kana: 'へびのこきゅう', theme: 'serpent', forms: [
      F(KATA[1], '委蛇斬り', 'いだぎり', 'Ủy Xà Trảm — nhát chém uốn cong', 'whip', { dmg: 50, cost: 14, len: 280 }),
      F(KATA[2], '狭頭の毒牙', 'きょうずのどくが', 'Hiệp Đầu Độc Nha — vòng ra sau đâm', 'flip', { dmg: 60, cost: 18, hits: 1, dist: 300 }),
      F(KATA[3], '塒締め', 'とぐろじめ', 'Thì Đế — cuộn tròn siết chặt', 'spin', { dmg: 20, cost: 20, hits: 5, r: 160 }),
      F(KATA[4], '頸蛇双生', 'けいじゃそうせい', 'Cảnh Xà Song Sinh — hai rắn song đầu', 'dragon', { dmg: 26, cost: 26, hits: 4, twin: 1 }),
      F(KATA[5], '蜿蜿長蛇', 'えんえんちょうだ', 'Uyển Uyển Trường Xà — trường xà lướt dài', 'dragon', { dmg: 30, cost: 30, hits: 5, big: 1 }),
    ]
  },
  wind: {
    jp: '風の呼吸', kana: 'かぜのこきゅう', theme: 'wind', forms: [
      F(KATA[1], '塵旋風・削ぎ', 'じんせんぷう・そぎ', 'Trần Toàn Phong · Tước — khoan lốc xoáy', 'dashSlash', { dmg: 18, cost: 16, dist: 420, hits: 5, drill: 1 }),
      F(KATA[2], '爪々・科戸風', 'そうそう・しなとのかぜ', 'Trảo Trảo · Khoa Hộ Phong — 4 vết móng gió', 'wave', { dmg: 22, cost: 16, size: 90, speed: 16, claws: 4 }),
      F(KATA[3], '晴嵐風樹', 'せいらんふうじゅ', 'Tình Lam Phong Thụ — lốc quanh mình', 'spin', { dmg: 18, cost: 18, hits: 5, r: 170 }),
      F(KATA[4], '昇上砂塵嵐', 'しょうじょうさじんらん', 'Thăng Thượng Sa Trần Lam — bão cát bốc lên', 'rise', { dmg: 18, cost: 18, hits: 5, fan: 1 }),
      F(KATA[5], '木枯らし颪', 'こがらしおろし', 'Mộc Khô Ma — gió lạnh từ trên giáng xuống', 'slam', { dmg: 65, cost: 20, r: 200 }),
      F(KATA[6], '黒風烟嵐', 'こくふうえんらん', 'Hắc Phong Yên Lam — chém vút lên', 'slash', { dmg: 60, cost: 20, r: 180, a0: 1.2, a1: -1.6, w: 40 }),
      F(KATA[7], '勁風・天狗風', 'けいふう・てんぐかぜ', 'Kính Phong · Thiên Cẩu Phong — từ trên cao bổ xuống', 'slam', { dmg: 55, cost: 20, r: 180, air: 1 }),
      F(KATA[8], '初烈風斬り', 'しょれつかざきり', 'Sơ Liệt Phong Trảm — một nhát gió cực mạnh', 'dashSlash', { dmg: 75, cost: 22, dist: 380, hits: 1 }),
      F(KATA[9], '韋駄天台風', 'いだてんたいふう', 'Vi Đà Thiên Đài Phong — bão xoay trên không', 'flip', { dmg: 26, cost: 28, hits: 4, dist: 200, air: 1, big: 1 }),
    ]
  },
  stone: {
    jp: '岩の呼吸', kana: 'いわのこきゅう', theme: 'stone', forms: [
      F(KATA[1], '蛇紋岩・双極', 'じゃもんがん・そうきょく', 'Xà Văn Nham · Song Cực — chùy và rìu song kích', 'throw', { dmg: 70, cost: 20, flail: 1 }),
      F(KATA[2], '天面砕き', 'てんめんくだき', 'Thiên Diện Toái — đập vỡ từ trên', 'slam', { dmg: 90, cost: 22, r: 220 }),
      F(KATA[3], '岩軀の膚', 'がんくのはだえ', 'Nham Khu Phu — xích quay quanh thân thành giáp', 'buff', { cost: 20, buff: 'guard', dur: 240, spinDmg: 10 }),
      F(KATA[4], '流紋岩・速征', 'りゅうもんがん・そくせい', 'Lưu Văn Nham · Tốc Chinh — chùy rìu dồn dập', 'barrage', { dmg: 26, cost: 24, n: 6, heavy: 1 }),
      F(KATA[5], '瓦輪刑部', 'がりんぎょうぶ', 'Ngõa Luân Hình Bộ — chùy rìu giáng từ trời', 'rain', { dmg: 70, cost: 30, n: 2, big: 1 }),
    ]
  },
  flower: {
    jp: '花の呼吸', kana: 'はなのこきゅう', theme: 'flower', forms: [
      F(KATA[2], '御影梅', 'みかげうめ', 'Ngự Ảnh Mai — xoay hoa mai chặn đòn', 'spin', { dmg: 18, cost: 16, hits: 4, r: 150, block: 1 }),
      F(KATA[4], '紅花衣', 'べにはなごろも', 'Hồng Hoa Y — chém xoáy áo hoa', 'slash', { dmg: 55, cost: 16, r: 160, a0: -1.0, a1: 1.0, w: 36 }),
      F(KATA[5], '徒の芍薬', 'あだのしゃくやく', 'Đồ Thược Dược — 9 nhát liên tiếp', 'multi', { dmg: 11, cost: 20, n: 9, r: 150 }),
      F(KATA[6], '渦桃', 'うずもも', 'Oa Đào — lộn xoáy trên không', 'flip', { dmg: 30, cost: 18, hits: 2, dist: 180, air: 1 }),
      F(['終ノ型', 'ついのかた'], '彼岸朱眼', 'ひがんしゅがん', 'Bỉ Ngạn Chu Nhãn — mắt thấy mọi thứ chậm lại (tốn máu)', 'buff', { cost: 20, buff: 'slow', dur: 300, hpCost: 20 }),
    ]
  },
  blood: {
    jp: '血鬼術', kana: 'けっきじゅつ', theme: 'blood', noZen: 1, forms: [
      F(null, '爆血', 'ばっけつ', 'Bạo Huyết — máu bốc cháy thiêu quỷ', 'aoe', { dmg: 70, cost: 24, r: 260, burn: 1, big: 1 }),
    ]
  },
};
STYLES.water11.forms = STYLES.water.forms.concat([
  F(KATA[11], '凪', 'なぎ', 'Phong Lặng — thức tự sáng tạo, mọi đòn trong tầm đều bị chém tan', 'buff', { cost: 26, buff: 'nagi', dur: 240, big: 1 }),
]);

// ---------------- CHARACTERS ----------------
// look: drawing spec used by draw.js
// atk: damage dealt x, def: damage taken x, brRegen: breath regen x, hpRegen/poisonRes: canon traits; pros/cons shown in guide
const CHARS = {
  tanjiro: {
    name: '竈門炭治郎', kana: 'かまどたんじろう', vn: 'Kamado Tanjiro', styles: ['water', 'sun'], hp: 230, br: 100, speed: 5.4, atk: 1.0, def: 0.95, brRegen: 1.0, voice: 1.15,
    look: { hair: '#5a1d1d', hairTip: '#a33', style: 'tanjiro', haori: 'check', h1: '#1d6b4a', h2: '#111', skin: '#f3d2b3', blade: '#1a1a1a', edge: '#ddd', scar: 1, earring: 1, box: 1 },
    pros: 'Toàn diện, 2 bộ hơi thở; đầu cứng, ý chí kiên cường (chịu đòn khá)', cons: 'Hinokami rất tốn hơi, không có chỉ số nào nổi trội',
    lines: { start: '全集中！', win: '俺は長男だから我慢できたけど…' }
  },
  nezuko: {
    name: '竈門禰豆子', kana: 'かまどねずこ', vn: 'Kamado Nezuko', styles: ['blood'], hp: 260, br: 100, speed: 5.8, atk: 1.1, def: 0.9, brRegen: 1.0, hpRegen: 0.04, voice: 1.6, kick: 1,
    look: { hair: '#1b1010', hairTip: '#d0573b', style: 'nezuko', haori: 'plain', h1: '#c46186', h2: '#7a3654', kimono: '#f2b8c6', skin: '#fbe2d0', muzzle: 1, ribbon: '#e6748e', noSword: 1 },
    pros: 'Quỷ: TỰ HỒI MÁU liên tục, cú đá rất mạnh, 爆血 giải độc cả đội', cons: 'Chỉ có 1 thuật, đánh cận chiến bằng chân',
    lines: { start: 'ムー！', win: 'ムー♪' }
  },
  zenitsu: {
    name: '我妻善逸', kana: 'あがつまぜんいつ', vn: 'Agatsuma Zenitsu', styles: ['thunder'], hp: 170, br: 100, speed: 6.6, atk: 1.15, def: 1.15, brRegen: 1.0, voice: 1.4, iai: 1,
    look: { hair: '#f2c832', hairTip: '#e08a1e', style: 'zenitsu', haori: 'tri', h1: '#f4c430', h2: '#fff', skin: '#f6d9bd', blade: '#ccc', edge: '#ffef80', sleepy: 1 },
    pros: 'Nhanh nhất game, rút kiếm 霹靂一閃 sát thương rất cao', cons: 'Mỏng máu, nhát gan (chịu đòn kém), chỉ biết thức 1 và thức 7',
    lines: { start: 'シィィィ…', win: '禰豆子ちゃーん！' }
  },
  inosuke: {
    name: '嘴平伊之助', kana: 'はしびらいのすけ', vn: 'Hashibira Inosuke', styles: ['beast'], hp: 230, br: 100, speed: 6.2, atk: 1.05, def: 0.9, brRegen: 0.9, voice: 0.85, dual: 1,
    look: { hair: '#222', style: 'boar', haori: 'none', h1: '#6b5a48', h2: '#3b3b3b', skin: '#e9c7a6', blade: '#99a', edge: '#ccd', saw: 1, shirtless: 1, pelt: 1 },
    pros: 'Cơ thể dẻo dai, da dày, song kiếm hoang dã, 空間識覚 tăng chí mạng', cons: 'Hơi thở tự học nên hồi hơi chậm',
    lines: { start: '猪突猛進！猪突猛進！', win: '伊之助様の勝ちだ！' }
  },
  kanao: {
    name: '栗花落カナヲ', kana: 'つゆりかなを', vn: 'Tsuyuri Kanao', styles: ['flower'], hp: 180, br: 100, speed: 6.2, atk: 1.0, def: 1.05, brRegen: 1.05, voice: 1.5,
    look: { hair: '#2a1530', hairTip: '#4a2050', style: 'kanao', haori: 'cape', h1: '#fff', h2: '#ddd', skin: '#fbe0cf', blade: '#bbb', edge: '#f7a6c8', clip: 1 },
    pros: 'Thị lực siêu phàm, kỹ thuật chính xác, 彼岸朱眼 làm chậm cả trận', cons: 'Thân thể mảnh, chiêu mắt tốn máu',
    lines: { start: '…', win: '姉さん…' }
  },
  giyu: {
    name: '冨岡義勇', kana: 'とみおかぎゆう', vn: 'Tomioka Giyu — Thủy Trụ', styles: ['water11'], hp: 270, br: 130, speed: 5.6, atk: 1.1, def: 0.85, brRegen: 1.2, voice: 0.85,
    look: { hair: '#14141c', style: 'giyu', haori: 'giyu', h1: '#7a1e22', h2: '#2a6a3a', h3: '#d8b040', skin: '#efd0b5', blade: '#2b4a8a', edge: '#cfe0ff' },
    pros: 'Trụ cột: phòng thủ vững nhất, hồi hơi nhanh, 凪 chém tan mọi đòn', cons: 'Không có đòn đánh xa, tốc độ trung bình',
    lines: { start: '俺は嫌われていない', win: '生殺与奪の権を他人に握らせるな' }
  },
  rengoku: {
    name: '煉獄杏寿郎', kana: 'れんごくきょうじゅろう', vn: 'Rengoku Kyojuro — Viêm Trụ', styles: ['flame'], hp: 300, br: 120, speed: 5.8, atk: 1.25, def: 0.85, brRegen: 1.0, voice: 0.95,
    look: { hair: '#f6c537', hairTip: '#d2352c', style: 'rengoku', haori: 'flame', h1: '#fff', h2: '#e2421c', skin: '#f3d0b0', blade: '#c0301c', edge: '#ffb070' },
    pros: 'Hỏa lực cực cao, máu trâu, 煉獄 là đòn đơn mạnh nhất', cons: 'Ít thức (6), đòn lửa tốn hơi',
    lines: { start: '心を燃やせ！', win: 'うまい！うまい！' }
  },
  shinobu: {
    name: '胡蝶しのぶ', kana: 'こちょうしのぶ', vn: 'Kocho Shinobu — Trùng Trụ', styles: ['insect'], hp: 150, br: 120, speed: 6.8, atk: 0.7, def: 1.25, brRegen: 1.1, voice: 1.45, rapier: 1,
    look: { hair: '#1a1028', hairTip: '#6a2f9a', style: 'shinobu', haori: 'butterfly', h1: '#fff', h2: '#7a3cb0', skin: '#fbe3d2', blade: '#80b0a0', edge: '#c0f0e0', clip: 1 },
    pros: 'Đâm nhanh nhất, độc tích tụ làm quỷ mất máu và giảm hồi máu', cons: 'Sức yếu nhất — không chém đứt cổ quỷ (sát thương thấp), rất mỏng máu',
    lines: { start: 'あらあら', win: '鬼と仲良くする夢を見ているんです' }
  },
  tengen: {
    name: '宇髄天元', kana: 'うずいてんげん', vn: 'Uzui Tengen — Âm Trụ', styles: ['sound'], hp: 290, br: 120, speed: 6.0, atk: 1.15, def: 0.85, brRegen: 1.0, poisonRes: 0.4, voice: 0.8, cleaver: 1,
    look: { hair: '#e8e8f0', style: 'tengen', haori: 'none', h1: '#334', h2: '#222', skin: '#f0cfb2', blade: '#ccc', edge: '#ffd27a', gems: 1, sleeveless: 1, paint: 1 },
    pros: 'Cựu nhẫn giả: KHÁNG ĐỘC (độc chỉ còn 40% thời gian), máu trâu, nổ diện rộng', cons: 'Chỉ 3 thức, đòn nổ có độ trễ',
    lines: { start: '派手に行くぜ！', win: '地味に終わったな…いや、ド派手だ！' }
  },
  mitsuri: {
    name: '甘露寺蜜璃', kana: 'かんろじみつり', vn: 'Kanroji Mitsuri — Luyến Trụ', styles: ['love'], hp: 240, br: 120, speed: 6.2, atk: 1.2, def: 0.95, brRegen: 1.0, voice: 1.6, whipBlade: 1,
    look: { hair: '#f48fb7', hairTip: '#9ad06a', style: 'mitsuri', haori: 'cape', h1: '#fff', h2: '#eee', skin: '#fbe0cf', blade: '#f5a0c0', edge: '#fff' },
    pros: 'Cơ bắp đặc gấp 8 lần — rất khỏe, kiếm roi tầm xa và cực dẻo', cons: 'Đòn quất rộng nhưng từng nhát nhẹ',
    lines: { start: 'キュンキュンしちゃう！', win: 'やったぁ！' }
  },
  muichiro: {
    name: '時透無一郎', kana: 'ときとうむいちろう', vn: 'Tokito Muichiro — Hà Trụ', styles: ['mist'], hp: 210, br: 120, speed: 6.6, atk: 1.1, def: 1.05, brRegen: 1.15, voice: 1.3,
    look: { hair: '#14141c', hairTip: '#4cc3b8', style: 'muichiro', haori: 'none', h1: '#2a2a3a', h2: '#222', skin: '#f6dcc8', blade: '#cfe8e8', edge: '#fff', baggy: 1 },
    pros: 'Thiên tài: rất nhanh, hồi hơi nhanh, 朧 ẩn thân đòn kế x2', cons: 'Thân hình nhỏ, chịu đòn hơi kém',
    lines: { start: '俺は時透無一郎だ', win: 'すぐに忘れるから' }
  },
  obanai: {
    name: '伊黒小芭内', kana: 'いぐろおばない', vn: 'Iguro Obanai — Xà Trụ', styles: ['serpent'], hp: 210, br: 120, speed: 6.4, atk: 1.05, def: 1.05, brRegen: 1.05, voice: 1.0, curved: 1,
    look: { hair: '#15151c', style: 'obanai', haori: 'stripe', h1: '#eee', h2: '#333', skin: '#f2d6c0', blade: '#8a7aaa', edge: '#e0d0ff', mask: 1, snake: 1, hetero: 1 },
    pros: 'Đòn uốn lượn khó đoán, nhanh, chính xác', cons: 'Thể hình nhỏ, chịu đòn hơi kém',
    lines: { start: '信用しない 信用しない', win: 'ネチネチ…' }
  },
  sanemi: {
    name: '不死川実弥', kana: 'しなずがわさねみ', vn: 'Shinazugawa Sanemi — Phong Trụ', styles: ['wind'], hp: 290, br: 120, speed: 6.2, atk: 1.2, def: 0.95, brRegen: 1.0, voice: 0.8,
    look: { hair: '#eef0ee', style: 'sanemi', haori: 'plain', h1: '#f3f3f3', h2: '#ccc', skin: '#f0cfb2', blade: '#5a9a6a', edge: '#e0ffe0', scars: 1, openChest: 1, kanji: '殺' },
    pros: 'Hung bạo: đánh rất mạnh, nhiều thức gió, chịu thương tích cực giỏi', cons: 'Lao vào liều lĩnh — ít đòn phòng thủ',
    lines: { start: 'ぶっ殺してやる！', win: 'チッ' }
  },
  gyomei: {
    name: '悲鳴嶼行冥', kana: 'ひめじまぎょうめい', vn: 'Himejima Gyomei — Nham Trụ', styles: ['stone'], hp: 380, br: 120, speed: 5.0, atk: 1.3, def: 0.8, brRegen: 1.0, voice: 0.6, flailW: 1, scale: 1.25,
    look: { hair: '#222', style: 'gyomei', haori: 'gyomei', h1: '#7a5a2a', h2: '#3a2a1a', skin: '#c9a07a', blade: '#888', edge: '#ccc', beads: 1, blind: 1 },
    pros: 'Trụ cột MẠNH NHẤT: sát thương và máu cao nhất, 岩軀の膚 giảm 70% sát thương', cons: 'Chậm nhất game',
    lines: { start: '南無阿弥陀仏…', win: 'ああ…なんと哀れな' }
  },
};

// ---------------- BOSSES ----------------
// attack types: melee, proj, lines, shock, circle, rain, summon, dash, sleep, arms, sweep
const BOSSES = {
  temoni: {
    name: '手鬼', kana: 'ておに', title: '異形の鬼', hp: 900, regen: 0, speed: 1.6, w: 150, h: 220, look: 'hand', neck: 1,
    atks: [
      { n: '', type: 'arms', tele: 40, dmg: 18, cd: 70, count: 3 },
      { n: '', type: 'melee', tele: 30, dmg: 20, cd: 60, range: 180 },
      { n: '', type: 'proj', tele: 30, dmg: 12, cd: 90, count: 3, speed: 7, size: 18, color: '#7a9a50', shape: 'hand' },
    ],
    p2: [{ n: '', type: 'arms', tele: 30, dmg: 20, cd: 50, count: 6 }],
  },
  susamaru: {
    name: '朱紗丸', kana: 'すさまる', title: '十二鬼月を名乗る鬼', hp: 1100, regen: 0.05, speed: 2.2, w: 90, h: 170, look: 'susamaru',
    atks: [
      { n: '遊びましょう！', type: 'proj', tele: 30, dmg: 16, cd: 70, count: 2, speed: 12, size: 26, color: '#e04040', shape: 'temari', bounce: 1 },
      { n: '', type: 'proj', tele: 40, dmg: 14, cd: 90, count: 6, speed: 9, size: 22, color: '#e8b030', shape: 'temari', bounce: 1, spread: 1 },
      { n: '', type: 'melee', tele: 25, dmg: 18, cd: 60, range: 150 },
    ],
    p2: [{ n: '六本腕の手毬', type: 'proj', tele: 35, dmg: 14, cd: 80, count: 6, speed: 11, size: 22, color: '#e04040', shape: 'temari', bounce: 1, spread: 1 }], // grows six arms
  },
  kyogai: {
    name: '響凱', kana: 'きょうがい', title: '元・下弦の陸', hp: 1300, regen: 0.06, speed: 1.4, w: 110, h: 210, look: 'kyogai',
    atks: [
      { n: '血鬼術', type: 'lines', tele: 40, dmg: 18, cd: 70, count: 3, style: 'claw' },
      { n: '', type: 'tilt', tele: 30, dmg: 0, cd: 200 },
      { n: '', type: 'melee', tele: 30, dmg: 18, cd: 60, range: 150 },
    ],
    p2: [{ n: '尚速鼓打ち', type: 'lines', tele: 30, dmg: 20, cd: 50, count: 6, style: 'claw' }],
  },
  rui: {
    name: '累', kana: 'るい', title: '下弦の伍', hp: 1700, regen: 0.15, speed: 1.6, w: 70, h: 150, look: 'rui', rank: '下伍',
    atks: [
      { n: '', type: 'lines', tele: 45, dmg: 20, cd: 70, count: 4, style: 'thread' },
      { n: '血鬼術 刻糸牢', type: 'cage', tele: 70, dmg: 30, cd: 160 },
      { n: '', type: 'proj', tele: 30, dmg: 14, cd: 80, count: 5, speed: 10, size: 10, color: '#f0f0ff', shape: 'thread', spread: 1 },
    ],
    p2: [{ n: '殺目篭', type: 'cage', tele: 55, dmg: 34, cd: 110, tight: 1 }],
  },
  enmu: {
    name: '魘夢', kana: 'えんむ', title: '下弦の壱', hp: 1600, regen: 0.15, speed: 1.4, w: 80, h: 170, look: 'enmu', rank: '下壱',
    atks: [
      { n: '血鬼術 強制昏倒催眠の囁き', type: 'sleep', tele: 60, dmg: 0, cd: 260 },
      { n: '', type: 'arms', tele: 40, dmg: 16, cd: 70, count: 4, flesh: 1 },
      { n: '', type: 'proj', tele: 35, dmg: 14, cd: 80, count: 4, speed: 8, size: 20, color: '#c080d0', shape: 'mouth', homing: 0.08 },
    ],
    p2: [{ n: '眠れ', type: 'sleep', tele: 40, dmg: 0, cd: 200 }, { n: '', type: 'arms', tele: 30, dmg: 18, cd: 50, count: 7, flesh: 1 }],
  },
  akaza: {
    name: '猗窩座', kana: 'あかざ', title: '上弦の参', hp: 3400, regen: 0.35, speed: 3.4, w: 70, h: 170, look: 'akaza', rank: '上参', dawn: 5400, flee: 1,
    atks: [
      { n: '破壊殺・空式', type: 'proj', tele: 25, dmg: 18, cd: 50, count: 4, speed: 16, size: 24, color: '#6cf', shape: 'fist' },
      { n: '破壊殺・乱式', type: 'melee', tele: 22, dmg: 26, cd: 50, range: 200, multi: 4 },
      { n: '破壊殺・脚式 冠先割', type: 'dash', tele: 30, dmg: 30, cd: 80 },
      { n: '術式展開 破壊殺・羅針', type: 'compass', tele: 50, dmg: 0, cd: 400 },
    ],
    p2: [
      { n: '破壊殺・脚式 流閃群光', type: 'dash', tele: 22, dmg: 30, cd: 60, triple: 1 },
      { n: '破壊殺・滅式', type: 'circle', tele: 50, dmg: 50, cd: 180, self: 1, r: 260 },
      { n: '破壊殺・鬼芯八重芯', type: 'proj', tele: 30, dmg: 20, cd: 70, count: 8, speed: 15, size: 22, color: '#6cf', shape: 'fist', spread: 1 },
    ],
  },
  akaza2: { // Infinity Castle rematch — only 2 slayers, so tuned below Douma/Kokushibo
    name: '猗窩座', kana: 'あかざ', title: '上弦の参', hp: 3500, regen: 0.28, speed: 3.5, w: 70, h: 170, look: 'akaza', rank: '上参', neckRegen: 1,
    atks: [
      { n: '破壊殺・空式', type: 'proj', tele: 26, dmg: 16, cd: 55, count: 4, speed: 16, size: 24, color: '#6cf', shape: 'fist' },
      { n: '破壊殺・砕式 万葉閃柳', type: 'shock', tele: 34, dmg: 24, cd: 90 },
      { n: '破壊殺・脚式 飛遊星千輪', type: 'dash', tele: 30, dmg: 26, cd: 80 },
      { n: '破壊殺・乱式', type: 'melee', tele: 24, dmg: 20, cd: 55, range: 200, multi: 4 },
    ],
    p2: [
      { n: '破壊殺・終式 青銀乱残光', type: 'storm', tele: 66, dmg: 18, cd: 240 },
      { n: '破壊殺・鬼芯八重芯', type: 'proj', tele: 30, dmg: 18, cd: 70, count: 7, speed: 15, size: 22, color: '#6cf', shape: 'fist', spread: 1 },
    ],
  },
  daki: {
    name: '堕姫', kana: 'だき', title: '上弦の陸', hp: 1700, regen: 0.25, speed: 2.4, w: 70, h: 180, look: 'daki', rank: '上陸', twin: 'gyutaro',
    atks: [
      { n: '血鬼術 八重帯斬り', type: 'lines', tele: 40, dmg: 20, cd: 70, count: 5, style: 'obi' },
      { n: '', type: 'proj', tele: 30, dmg: 16, cd: 70, count: 3, speed: 12, size: 26, color: '#d04070', shape: 'obi' },
    ],
    p2: [{ n: '八重帯斬り', type: 'lines', tele: 30, dmg: 22, cd: 55, count: 8, style: 'obi' }],
  },
  gyutaro: {
    name: '妓夫太郎', kana: 'ぎゅうたろう', title: '上弦の陸', hp: 2000, regen: 0.25, speed: 2.8, w: 70, h: 180, look: 'gyutaro', rank: '上陸',
    atks: [
      { n: '血鬼術 飛び血鎌', type: 'proj', tele: 30, dmg: 18, cd: 70, count: 4, speed: 11, size: 22, color: '#e02040', shape: 'sickle', homing: 0.05, poison: 1 },
      { n: '', type: 'melee', tele: 22, dmg: 22, cd: 50, range: 170, poison: 1 },
    ],
    p2: [{ n: '円斬旋回・飛び血鎌', type: 'circle', tele: 45, dmg: 30, cd: 150, self: 1, r: 300, poison: 1 }],
  },
  gyokko: {
    name: '玉壺', kana: 'ぎょっこ', title: '上弦の伍', hp: 2200, regen: 0.3, speed: 1.2, w: 90, h: 170, look: 'gyokko', rank: '上伍', teleport: 1,
    atks: [
      { n: '血鬼術 千本針 魚殺', type: 'proj', tele: 35, dmg: 12, cd: 70, count: 10, speed: 13, size: 8, color: '#e0e0a0', shape: 'needle', spread: 1 },
      { n: '血鬼術 一万滑空粘魚', type: 'rain', tele: 40, dmg: 14, cd: 100, count: 14, shape: 'fish' },
      { n: '血鬼術 水獄鉢', type: 'circle', tele: 55, dmg: 28, cd: 150, r: 110, water: 1 },
    ],
    p2: [{ n: '血鬼術 陣殺魚鱗', type: 'dash', tele: 25, dmg: 26, cd: 60, triple: 1 }],
  },
  hantengu: {
    name: '憎珀天', kana: 'ぞうはくてん', title: '上弦の肆 半天狗', hp: 3000, regen: 0.35, speed: 1.0, w: 90, h: 170, look: 'hantengu', rank: '上肆', trueBody: 1,
    atks: [
      { n: '血鬼術 石竜子', type: 'arms', tele: 40, dmg: 22, cd: 80, count: 4, dragon: 1 },
      { n: '狂鳴雷殺', type: 'lines', tele: 40, dmg: 22, cd: 90, count: 5, style: 'bolt' },
      { n: '狂圧鳴波', type: 'shock', tele: 35, dmg: 20, cd: 80 },
      { n: '', type: 'proj', tele: 30, dmg: 16, cd: 70, count: 3, speed: 14, size: 26, color: '#ccc', shape: 'wind' },
    ],
    p2: [{ n: '無間業樹', type: 'arms', tele: 40, dmg: 26, cd: 90, count: 9, dragon: 1 }],
  },
  doma: {
    name: '童磨', kana: 'どうま', title: '上弦の弐', hp: 4200, regen: 0.5, speed: 2.4, w: 70, h: 180, look: 'doma', rank: '上弐', frost: 1,
    atks: [
      { n: '血鬼術 蓮葉氷', type: 'rain', tele: 40, dmg: 14, cd: 80, count: 10, shape: 'lotus' },
      { n: '血鬼術 枯園垂り', type: 'melee', tele: 25, dmg: 24, cd: 55, range: 220, multi: 3 },
      { n: '血鬼術 散り蓮華', type: 'circle', tele: 45, dmg: 24, cd: 110, r: 150, ice: 1 },
      { n: '血鬼術 冬ざれ氷柱', type: 'rain', tele: 35, dmg: 20, cd: 100, count: 7, shape: 'icicle' },
    ],
    p2: [
      { n: '血鬼術 寒烈の白姫', type: 'lines', tele: 50, dmg: 24, cd: 120, count: 2, style: 'frost' },
      { n: '血鬼術 結晶ノ御子', type: 'summon', tele: 40, cd: 300, minion: 'mini_doma', count: 2 },
    ],
  },
  kokushibo: {
    name: '黒死牟', kana: 'こくしぼう', title: '上弦の壱', hp: 5600, regen: 0.5, speed: 2.6, w: 80, h: 200, look: 'kokushibo', rank: '上壱',
    atks: [
      { n: '月の呼吸 壱ノ型 闇月・宵の宮', type: 'lines', tele: 30, dmg: 26, cd: 60, count: 1, style: 'moon', horiz: 1 },
      { n: '月の呼吸 弐ノ型 珠華ノ弄月', type: 'lines', tele: 35, dmg: 22, cd: 70, count: 3, style: 'moon' },
      { n: '月の呼吸 参ノ型 厭忌月・銷り', type: 'proj', tele: 30, dmg: 20, cd: 70, count: 2, speed: 14, size: 60, color: '#d8c0ff', shape: 'crescent' },
      { n: '月の呼吸 伍ノ型 月魄災渦', type: 'circle', tele: 40, dmg: 30, cd: 120, self: 1, r: 220, moon: 1 },
      { n: '月の呼吸 陸ノ型 常夜孤月・無間', type: 'lines', tele: 40, dmg: 24, cd: 100, count: 7, style: 'moon' },
    ],
    p2: [
      { n: '月の呼吸 漆ノ型 厄鏡・月映え', type: 'proj', tele: 30, dmg: 22, cd: 70, count: 4, speed: 16, size: 70, color: '#d8c0ff', shape: 'crescent', ground: 1 },
      { n: '月の呼吸 捌ノ型 月龍輪尾', type: 'sweep', tele: 45, dmg: 34, cd: 110 },
      { n: '月の呼吸 拾ノ型 穿面斬・蘿月', type: 'lines', tele: 35, dmg: 26, cd: 90, count: 3, style: 'moon', vert: 1 },
      { n: '月の呼吸 拾肆ノ型 兇変・天満繊月', type: 'storm', tele: 60, dmg: 22, cd: 200, moon: 1 },
      { n: '月の呼吸 拾陸ノ型 月虹・片割れ月', type: 'rain', tele: 40, dmg: 30, cd: 120, count: 6, shape: 'moonbeam' },
    ],
  },
  muzan: {
    name: '鬼舞辻無惨', kana: 'きぶつじむざん', title: '鬼の始祖', hp: 9000, regen: 0.7, speed: 2.6, w: 80, h: 190, look: 'muzan', dawn: 7200, final: 1,
    atks: [
      { n: '', type: 'sweep', tele: 35, dmg: 26, cd: 70, whip: 1 },
      { n: '', type: 'lines', tele: 35, dmg: 24, cd: 60, count: 4, style: 'whip' },
      { n: '', type: 'arms', tele: 35, dmg: 24, cd: 80, count: 6, thorn: 1 },
      { n: '', type: 'shock', tele: 30, dmg: 22, cd: 90 },
    ],
    p2: [
      { n: '黒血枳棘', type: 'lines', tele: 30, dmg: 28, cd: 60, count: 8, style: 'whip' },
      { n: '', type: 'storm', tele: 50, dmg: 22, cd: 160, whip: 1 },
      { n: '', type: 'circle', tele: 40, dmg: 40, cd: 140, self: 1, r: 300, blood: 1 },
    ],
  },
  // ---- story waves: the demons met on the way to each arc's boss
  yahaba: { name: '矢琶羽', kana: 'やはば', title: '十二鬼月を名乗る鬼', hp: 800, regen: 0.05, speed: 1.6, w: 80, h: 170, look: 'yahaba',
    atks: [
      { n: '血鬼術 紅潔の矢', type: 'lines', tele: 45, dmg: 16, cd: 80, count: 3, style: 'arrow' },
      { n: '', type: 'proj', tele: 30, dmg: 12, cd: 80, count: 3, speed: 9, size: 14, color: '#ff4848', shape: 'orb', homing: 0.06 },
      { n: '', type: 'melee', tele: 25, dmg: 14, cd: 60, range: 140 },
    ] },
  shitaoni: { name: '舌鬼', kana: 'したおに', title: '鼓屋敷の鬼', hp: 800, regen: 0.05, speed: 1.5, w: 90, h: 180, look: 'shitaoni',
    atks: [
      { n: '', type: 'lines', tele: 40, dmg: 15, cd: 70, count: 2, style: 'tongue' },
      { n: '', type: 'melee', tele: 25, dmg: 16, cd: 60, range: 160 },
      { n: '', type: 'dash', tele: 30, dmg: 16, cd: 90 },
    ] },
  spider_mother: { name: '母蜘蛛', kana: 'ははぐも', title: '累の「家族」', hp: 900, regen: 0.05, speed: 1.4, w: 70, h: 160, look: 'spider_mother',
    atks: [
      { n: '操り糸', type: 'summon', tele: 40, cd: 300, minion: 'puppet', count: 2 },
      { n: '', type: 'lines', tele: 45, dmg: 15, cd: 75, count: 3, style: 'thread' },
      { n: '', type: 'proj', tele: 30, dmg: 12, cd: 80, count: 4, speed: 9, size: 10, color: '#f0f0ff', shape: 'thread', spread: 1 },
    ] },
  puppet: { name: '操り人形', kana: '', hp: 150, regen: 0, speed: 1.6, w: 50, h: 140, look: 'puppet', minion: 1,
    atks: [{ n: '', type: 'melee', tele: 30, dmg: 10, cd: 70, range: 100 }] },
  spider_father: { name: '父蜘蛛', kana: 'ちちぐも', title: '累の「家族」', hp: 1500, regen: 0.1, speed: 1.3, w: 130, h: 260, look: 'spiderdad', scale: 1.65,
    atks: [
      { n: '', type: 'melee', tele: 32, dmg: 24, cd: 70, range: 230, multi: 2 },
      { n: '俺の家族に近づくな', type: 'dash', tele: 34, dmg: 26, cd: 100 },
      { n: '', type: 'shock', tele: 34, dmg: 20, cd: 110 },
    ] },
  enmu_roof: { name: '魘夢', kana: 'えんむ', title: '下弦の壱', hp: 800, regen: 0.1, speed: 1.4, w: 80, h: 170, look: 'enmu', rank: '下壱',
    atks: [
      { n: '血鬼術 強制昏倒催眠の囁き', type: 'sleep', tele: 60, dmg: 0, cd: 300 },
      { n: '', type: 'proj', tele: 35, dmg: 13, cd: 80, count: 3, speed: 8, size: 20, color: '#c080d0', shape: 'mouth', homing: 0.07 },
      { n: '', type: 'arms', tele: 40, dmg: 14, cd: 90, count: 3, flesh: 1 },
    ] },
  daki_solo: { name: '堕姫', kana: 'だき', title: '上弦の陸', hp: 1200, regen: 0.2, speed: 2.4, w: 70, h: 180, look: 'daki', rank: '上陸',
    atks: [
      { n: '血鬼術 八重帯斬り', type: 'lines', tele: 40, dmg: 18, cd: 75, count: 4, style: 'obi' },
      { n: '', type: 'proj', tele: 30, dmg: 15, cd: 70, count: 3, speed: 12, size: 26, color: '#d04070', shape: 'obi' },
    ] },
  kingyo: { name: '金魚', kana: 'きんぎょ', title: '玉壺の壺', hp: 240, regen: 0, speed: 1.5, w: 60, h: 100, look: 'kingyo', minion: 1, scale: 0.6,
    atks: [{ n: '', type: 'proj', tele: 35, dmg: 9, cd: 90, count: 5, speed: 11, size: 8, color: '#e0e0a0', shape: 'needle', spread: 1 }] },
  sekido: { name: '積怒', kana: 'せきど', title: '上弦の肆 分裂体', hp: 900, regen: 0.15, speed: 1.3, w: 80, h: 170, look: 'sekido', rank: '上肆',
    atks: [
      { n: '錫杖・雷', type: 'lines', tele: 40, dmg: 18, cd: 85, count: 3, style: 'bolt' },
      { n: '', type: 'melee', tele: 26, dmg: 18, cd: 60, range: 170 },
    ] },
  karaku: { name: '可楽', kana: 'からく', title: '上弦の肆 分裂体', hp: 900, regen: 0.15, speed: 1.7, w: 80, h: 170, look: 'karaku', rank: '上肆',
    atks: [
      { n: '八つ手の団扇', type: 'proj', tele: 30, dmg: 14, cd: 75, count: 4, speed: 13, size: 26, color: '#ccc', shape: 'wind', spread: 1 },
      { n: '', type: 'circle', tele: 45, dmg: 22, cd: 140, self: 1, r: 220 },
    ] },
  urogi: { name: '空喜', kana: 'うろぎ', title: '上弦の肆 分裂体', hp: 900, regen: 0.15, speed: 2.2, w: 80, h: 170, look: 'urogi', rank: '上肆',
    atks: [
      { n: '超音波', type: 'shock', tele: 32, dmg: 18, cd: 85 },
      { n: '', type: 'dash', tele: 26, dmg: 20, cd: 80, triple: 1 },
    ] },
  aizetsu: { name: '哀絶', kana: 'あいぜつ', title: '上弦の肆 分裂体', hp: 900, regen: 0.15, speed: 1.9, w: 80, h: 170, look: 'aizetsu', rank: '上肆',
    atks: [
      { n: '激涙刺突', type: 'melee', tele: 24, dmg: 18, cd: 60, range: 240, multi: 4 },
      { n: '', type: 'lines', tele: 35, dmg: 18, cd: 80, count: 3, style: 'spear' },
    ] },
  dummy: {
    name: '巻藁', kana: 'まきわら', title: '稽古台', hp: 5000, regen: 30, speed: 0, w: 70, h: 180, look: 'dummy', training: 1, atks: [],
  },
  // minions
  mini: { name: '鬼', kana: 'おに', hp: 160, regen: 0, speed: 1.8, w: 50, h: 120, look: 'minion', minion: 1,
    atks: [{ n: '', type: 'melee', tele: 30, dmg: 10, cd: 70, range: 90 }] },
  mini_doma: { name: '結晶ノ御子', kana: '', hp: 260, regen: 0, speed: 2.2, w: 40, h: 100, look: 'icechild', minion: 1,
    atks: [{ n: '', type: 'proj', tele: 30, dmg: 10, cd: 90, count: 3, speed: 10, size: 12, color: '#bdf', shape: 'icicle' }] },
};

// ---------------- STAGES ----------------
// dlg: [speaker key | boss key, jp, vn]
const STAGES = [
  {
    id: 1, arc: '最終選別', arcVn: 'Tuyển Chọn Cuối Cùng', place: '藤襲山', bg: 'wisteria', team: ['tanjiro'], boss: 'temoni',
    phases: [{ minions: 3, t: ['藤襲山の鬼', 'Quỷ núi Fujikasane'], lines: [['tanjiro', '鬼の匂いだ…！ 囲まれている', 'Mùi quỷ...! Mình bị bao vây rồi.']] }],
    last: [['temoni', 'また来たな 鱗滝の弟子が', 'Lại tới nữa rồi, đệ tử của Urokodaki.']],
    intro: [
      ['temoni', '可愛い狐が来た…', 'Lại một con cáo nhỏ dễ thương tới nữa...'],
      ['temoni', '鱗滝の弟子だろう？ 今は明治何年だ？', 'Đệ tử của Urokodaki phải không? Giờ là năm Meiji thứ mấy?'],
      ['tanjiro', '今は大正時代だ', 'Bây giờ là thời Taisho.'],
      ['temoni', 'ウアアアア！！ 年号がァ！！', 'ÁAAAA!! Niên hiệu đã đổi rồi!!'],
      ['tanjiro', '全集中・水の呼吸…！', 'Toàn tập trung · Hơi thở của Nước...!'],
    ],
    outro: [['tanjiro', '神様… どうか この人が今度生まれてくる時は 鬼になんてなりませんように', 'Thần linh ơi... xin cho người này kiếp sau đừng trở thành quỷ nữa.']],
  },
  {
    id: 2, arc: '浅草', arcVn: 'Asakusa — Quỷ Tay Cầu', place: '珠世の屋敷', bg: 'town', team: ['tanjiro', 'nezuko'], boss: 'susamaru', ally: 'tamayo',
    phases: [{ bosses: ['yahaba'], t: ['矢琶羽', 'Yahaba'], lines: [['yahaba', '鬼狩りめ… 矢印で捻り潰してやる', 'Thợ săn quỷ... ta sẽ bẻ nát ngươi bằng mũi tên.'], ['tamayo', '炭治郎さん 私が援護します', 'Tanjiro, tôi sẽ yểm trợ cậu.']] }],
    last: [['susamaru', '矢琶羽を…！ 遊びは終わりじゃ', 'Dám hạ Yahaba...! Hết chơi rồi!']],
    intro: [
      ['susamaru', 'キャハハハ！ 耳に花札のような飾りの鬼狩りは お前じゃのう', 'Kyahahaha! Thợ săn quỷ đeo hoa tai hanafuda là ngươi đúng không!'],
      ['susamaru', '遊びましょう！ 遊びましょう！', 'Chơi nào! Chơi nào!'],
      ['tanjiro', '禰豆子！ 行くぞ！', 'Nezuko! Đi thôi!'],
      ['nezuko', 'ムー！', 'Mư!'],
    ],
    outro: [['tanjiro', '鞠を…', 'Quả cầu...'], ['susamaru', '遊ぼう… 遊ぼう…', 'Chơi... chơi nữa đi...']],
  },
  {
    id: 3, arc: '鼓屋敷', arcVn: 'Dinh Thự Trống', place: '鼓屋敷', bg: 'mansion', team: ['tanjiro', 'zenitsu', 'inosuke'], boss: 'kyogai',
    phases: [{ bosses: ['shitaoni'], t: ['舌鬼', 'Quỷ Lưỡi'], lines: [['shitaoni', '稀血… 稀血の匂いだ', 'Máu hiếm... mùi máu hiếm...'], ['zenitsu', 'ぎゃああ！ 舌が長いぃぃ！', 'ÁAAA! Cái lưỡi dài quáaaa!']] }],
    last: [['kyogai', '小生の獲物を…', 'Con mồi của tiểu sinh...']],
    intro: [
      ['kyogai', '小生の…血鬼術…', 'Huyết quỷ thuật... của tiểu sinh...'],
      ['inosuke', '猪突猛進！ 猪突猛進！', 'Lợn rừng lao tới! Lợn rừng lao tới!'],
      ['zenitsu', '怖いよぉぉぉ！ 炭治郎ぉぉ！', 'Sợ quááá! Tanjirooo!'],
      ['tanjiro', '部屋が回る…！ 鼓の音だ！', 'Căn phòng xoay...! Là tiếng trống!'],
    ],
    outro: [['kyogai', '小生の血鬼術は…凄いか…', 'Huyết quỷ thuật của tiểu sinh... có tuyệt không...'], ['tanjiro', '凄かった！ でも人を殺したことは許さない', 'Rất tuyệt! Nhưng ta không tha cho việc ngươi giết người.']],
  },
  {
    id: 4, arc: '那田蜘蛛山', arcVn: 'Núi Natagumo', place: '那田蜘蛛山', bg: 'spider', team: ['tanjiro', 'nezuko', 'inosuke', 'zenitsu', 'giyu', 'shinobu'], boss: 'rui',
    phases: [
      { bosses: ['spider_mother'], t: ['母蜘蛛', 'Mẹ Nhện'], lines: [['spider_mother', '早く殺さないと… 累に叱られる', 'Phải giết nhanh... không thì Rui sẽ mắng.'], ['tanjiro', '糸で 隊士を操っている…！', 'Bà ta dùng tơ điều khiển các kiếm sĩ...!']] },
      { bosses: ['spider_father'], t: ['父蜘蛛', 'Cha Nhện'], lines: [['spider_father', '俺の家族に 近づくなァァ！！', 'KHÔNG ĐƯỢC LẠI GẦN GIA ĐÌNH TAAA!!'], ['inosuke', 'デカすぎだろォ！？', 'To quá vậy hảaa!?']] },
    ],
    last: [['rui', '僕の家族を…よくも', 'Dám động vào gia đình ta...']],
    intro: [
      ['rui', '僕たち家族の静かな暮らしを 邪魔するな', 'Đừng làm phiền cuộc sống yên bình của gia đình ta.'],
      ['tanjiro', '本物の絆を ニセモノと言うな！', 'Đừng gọi sợi dây gắn kết thật sự là đồ giả!'],
      ['rui', '血鬼術 刻糸牢', 'Huyết quỷ thuật · Khắc Ti Lao.'],
      ['tanjiro', '父さん… ヒノカミ神楽！', 'Cha ơi... Hinokami Kagura!'],
    ],
    outro: [['giyu', '俺が来るまでよく堪えた', 'Cậu đã chịu đựng tốt cho tới khi tôi đến.'], ['rui', '父さん…母さん…', 'Cha... mẹ...']],
  },
  {
    id: 5, arc: '無限列車', arcVn: 'Chuyến Tàu Vô Tận', place: '無限列車', bg: 'train', team: ['tanjiro', 'rengoku', 'inosuke', 'zenitsu', 'nezuko'], boss: 'enmu',
    phases: [{ bosses: ['enmu_roof'], t: ['列車の屋根', 'Trên nóc tàu'], lines: [['enmu', 'あれぇ 起きちゃったの？', 'Ơ kìa, tỉnh dậy rồi sao?']] }],
    last: [['enmu', 'もう 俺はこの列車と融合した！ 二百人の人質だ', 'Ta đã hợp nhất với đoàn tàu! Hai trăm con tin đó!'], ['rengoku', '竈門少年！ 頸を探せ！', 'Thiếu niên Kamado! Tìm cái cổ!']],
    intro: [
      ['enmu', 'ねんねんころり… こんころり', 'Ngủ đi ngủ đi... ngủ ngoan nào...'],
      ['enmu', 'お眠り', 'Ngủ đi.'],
      ['tanjiro', '夢の中で… 自分の頸を斬れば 目覚める！', 'Trong mơ... tự chém cổ mình là sẽ tỉnh!'],
      ['rengoku', '竈門少年！ 俺は五両を守る！', 'Thiếu niên Kamado! Ta sẽ bảo vệ năm toa!'],
    ],
    outro: [['enmu', 'あの方に…', 'Ngài ấy...'], ['inosuke', '俺が斬ったんだ！', 'Là ta chém đó!']],
  },
  {
    id: 6, arc: '無限列車', arcVn: 'Thượng Huyền Tam — Akaza', place: '線路脇', bg: 'dawnfield', team: ['rengoku', 'tanjiro', 'inosuke'], boss: 'akaza',
    intro: [
      ['akaza', '杏寿郎 お前も鬼にならないか？', 'Kyojuro, ngươi có muốn trở thành quỷ không?'],
      ['rengoku', 'ならない', 'Không bao giờ.'],
      ['rengoku', '老いることも 死ぬことも 人間という儚い生き物の美しさだ', 'Già đi rồi chết, đó là vẻ đẹp của sinh vật mong manh gọi là con người.'],
      ['akaza', '術式展開 破壊殺・羅針', 'Triển khai thuật thức · Phá Hoại Sát · La Châm.'],
      ['rengoku', '心を燃やせ！', 'Hãy để trái tim bùng cháy!'],
    ],
    note: 'Cầm cự tới bình minh! Mặt trời mọc → Akaza bỏ chạy.',
    outro: [['akaza', '日が…！', 'Mặt trời...!'], ['tanjiro', '逃げるな卑怯者！！ 煉獄さんの方が凄いんだ！！', 'Đừng chạy, đồ hèn nhát!! Rengoku-san mạnh hơn nhiều!!'], ['rengoku', '胸を張って生きろ', 'Hãy sống thật hiên ngang.']],
  },
  {
    id: 7, arc: '遊郭編', arcVn: 'Phố Đèn Đỏ — Daki & Gyutaro', place: '吉原遊郭', bg: 'yukaku', team: ['tengen', 'tanjiro', 'zenitsu', 'inosuke', 'nezuko'], boss: 'daki', boss2: 'gyutaro',
    phases: [{ bosses: ['daki_solo'], t: ['堕姫', 'Daki'], lines: [['daki', 'この私に逆らうの？ 醜いわね', 'Dám chống lại ta sao? Xấu xí thật.']] }],
    last: [['daki', 'お兄ちゃああん！！', 'ANH ƠIIII!!'], ['gyutaro', '妹を泣かせたなァ… 取り立てるぜ', 'Dám làm em gái ta khóc hả... ta đòi nợ đây.']],
    intro: [
      ['daki', '不細工ね お前', 'Xấu xí quá, ngươi.'],
      ['gyutaro', '取り立てるぜ 俺はなぁ', 'Ta sẽ đòi nợ đấy, ta mà.'],
      ['tengen', '二人同時に頸を斬らねえと死なねえ！ 派手に行くぜ！', 'Phải chém cổ cả hai cùng lúc mới chết! Lên thật hoành tráng nào!'],
    ],
    note: 'Phải hạ CẢ HAI trong vòng 4 giây, nếu không chúng hồi sinh!',
    outro: [['gyutaro', '梅…', 'Ume...'], ['tengen', '譜面が完成した！ 勝ちに行くぞォ！', 'Bản nhạc đã hoàn thành! Thắng thôi!']],
  },
  {
    id: 8, arc: '刀鍛冶の里編', arcVn: 'Làng Rèn Kiếm — Gyokko', place: '刀鍛冶の里', bg: 'village', team: ['muichiro'], boss: 'gyokko',
    phases: [{ bosses: ['kingyo', 'kingyo', 'kingyo'], t: ['壺の金魚', 'Cá vàng trong bình'], lines: [['muichiro', '金魚…？ 気持ち悪い', 'Cá vàng...? Kinh tởm.']] }],
    last: [['gyokko', '私の可愛い金魚を よくも！', 'Dám giết lũ cá vàng đáng yêu của ta!']],
    intro: [
      ['gyokko', 'ヒョッヒョッ 私の壺の芸術を見よ！', 'Hyo hyo! Hãy chiêm ngưỡng nghệ thuật bình gốm của ta!'],
      ['muichiro', '俺は 時透無一郎だ', 'Ta là Tokito Muichiro.'],
      ['muichiro', '思い出した… 人のためにすることは 巡り巡って自分のためになる', 'Ta nhớ ra rồi... làm việc vì người khác, cuối cùng cũng là vì chính mình.'],
    ],
    outro: [['gyokko', 'この私が… 頸を…！', 'Ta mà... bị chém cổ...!'], ['muichiro', 'もう二度と生まれてこなくていいからね', 'Đừng bao giờ sinh ra nữa nhé.']],
  },
  {
    id: 9, arc: '刀鍛冶の里編', arcVn: 'Làng Rèn Kiếm — Hantengu', place: '刀鍛冶の里', bg: 'village', team: ['tanjiro', 'mitsuri', 'nezuko'], boss: 'hantengu',
    phases: [
      { bosses: ['sekido', 'karaku'], t: ['積怒・可楽', 'Sekido & Karaku'], lines: [['karaku', 'カカカッ 楽しいのう', 'Ka ka ka! Vui thật đấy!'], ['sekido', '腹立たしい…', 'Thật đáng giận...']] },
      { bosses: ['urogi', 'aizetsu'], t: ['空喜・哀絶', 'Urogi & Aizetsu'], lines: [['urogi', 'カカッ 愉快じゃ 愉快じゃ', 'Kaka! Khoái chí, khoái chí!'], ['aizetsu', '悲しい…', 'Thật đáng buồn...']] },
    ],
    last: [['hantengu', '憎い… 憎い…', 'Căm ghét... căm ghét...'], ['tanjiro', '鬼が 合体した…！？', 'Lũ quỷ... hợp thể rồi!?']],
    intro: [
      ['hantengu', '何故 弱い者いじめをするのか', 'Vì sao các ngươi lại bắt nạt kẻ yếu?'],
      ['mitsuri', '私 キュンキュンしちゃう！ 本気で行くね！', 'Tim tớ đập thình thịch rồi! Tớ nghiêm túc đây!'],
      ['tanjiro', '本体は小さい鬼だ！ 必ず頸を斬る！', 'Bản thể là con quỷ nhỏ! Nhất định phải chém cổ nó!'],
    ],
    note: 'Bản thể nhỏ (恨) sẽ xuất hiện — chém nó để gây sát thương chí mạng!',
    outro: [['nezuko', 'お…はよう', 'Chào... buổi sáng.'], ['tanjiro', '禰豆子が… 太陽を克服した…！', 'Nezuko... đã khắc phục được mặt trời...!']],
  },
  {
    id: 10, arc: '無限城決戦', arcVn: 'Vô Hạn Thành — Douma', place: '無限城', bg: 'castle_ice', team: ['shinobu', 'kanao', 'inosuke'], boss: 'doma',
    intro: [
      ['doma', 'やあやあ 初めまして 俺の名前は童磨', 'Ya ya, hân hạnh. Tên ta là Douma.'],
      ['shinobu', '姉を殺したのは お前ですね？', 'Kẻ đã giết chị ta... là ngươi phải không?'],
      ['doma', 'ああ 花の呼吸の娘かな？', 'À, cô gái dùng Hơi thở Hoa đó sao?'],
      ['kanao', '姉さん… 必ず仇は取る', 'Chị ơi... em nhất định báo thù.'],
    ],
    note: 'Độc của Shinobu tích tụ — Douma hồi máu chậm dần khi trúng độc.',
    outro: [['doma', '…ああ これが恋か', '...À, ra đây là tình yêu sao.'], ['shinobu', 'とっととくたばれ 糞野郎', 'Chết quách đi, đồ khốn.']],
  },
  {
    id: 11, arc: '無限城決戦', arcVn: 'Vô Hạn Thành — Akaza tái đấu', place: '無限城', bg: 'castle', team: ['tanjiro', 'giyu'], boss: 'akaza2',
    intro: [
      ['akaza', '弱者には虫唾が走る', 'Kẻ yếu khiến ta buồn nôn.'],
      ['tanjiro', '透き通る世界… 闘気を消す', 'Thế giới trong suốt... xóa bỏ đấu khí.'],
      ['giyu', '拾壱ノ型 凪', 'Thức thứ mười một · Phong Lặng.'],
    ],
    outro: [['akaza', '恋雪…', 'Koyuki...'], ['tanjiro', '…ありがとう', '...Cảm ơn.']],
  },
  {
    id: 12, arc: '無限城決戦', arcVn: 'Vô Hạn Thành — Kokushibo', place: '無限城', bg: 'castle_moon', team: ['gyomei', 'sanemi', 'muichiro'], boss: 'kokushibo',
    intro: [
      ['kokushibo', '月の呼吸…', 'Hơi thở của Trăng...'],
      ['sanemi', 'テメエの頸ィ 叩き斬ってやる！', 'Ta sẽ chém bay đầu mày!'],
      ['gyomei', '南無阿弥陀仏…', 'Nam mô A Di Đà Phật...'],
      ['muichiro', '先祖様… 俺はあなたを倒す', 'Tổ tiên... ta sẽ đánh bại ngài.'],
    ],
    outro: [['kokushibo', '私は一体 何の為に生まれてきたのだ…', 'Rốt cuộc... ta sinh ra để làm gì...']],
  },
  {
    id: 13, arc: '最終決戦', arcVn: 'TRẬN CUỐI — Kibutsuji Muzan', place: '東京の街', bg: 'city', team: ['tanjiro', 'giyu', 'zenitsu', 'inosuke', 'kanao', 'obanai', 'mitsuri', 'sanemi', 'gyomei', 'nezuko'], boss: 'muzan',
    intro: [
      ['muzan', 'しつこい', 'Dai dẳng thật.'],
      ['muzan', '私に殺されることは 大災に遭ったのと同じだと思え', 'Hãy coi việc bị ta giết như gặp phải thiên tai.'],
      ['tanjiro', '無惨！！ お前は存在してはいけない生き物だ！', 'MUZAN!! Ngươi là sinh vật không được phép tồn tại!'],
      ['tamayo', '無惨 あなたの体には もう私の薬が回っている', 'Muzan, thuốc của ta đã ngấm khắp người ngươi rồi.'],
      ['gyomei', '夜明けまで 奴をここに留めろ！', 'Giữ hắn ở lại đây cho tới bình minh!'],
    ],
    drug: 1, // Tamayo's drug: Muzan regenerates at about half speed
    note: 'Cầm cự tới BÌNH MINH. Thuốc của Tamayo làm Muzan hồi máu chậm một nửa. Đánh trúng Muzan đẩy nhanh thanh 夜明け!',
    outro: [
      ['tanjiro', '夜明けだ…！', 'Bình minh rồi...!'],
      ['muzan', '太陽が…！ ギャアアア！！', 'Mặt trời...! GYAAAA!!'],
      ['tanjiro', '帰ろう… 禰豆子', 'Về nhà thôi... Nezuko.'],
    ],
  },
];

// ---------------- ALLIES ----------------
// Tamayo: a demon who left Muzan — a physician. She fights at your side in Asakusa, and her drug weakens Muzan at the end.
const ALLIES = {
  tamayo: { name: '珠世', kana: 'たまよ', vn: 'Tamayo', voice: 1.05,
    look: { hair: '#120c16', style: 'daki', kanzashi: 1, haori: 'none', kimono: '#3c2250', obi: '#d8b878', skin: '#f8e8e0', eye: '#c27ad8', noSword: 1, blush: 1 } },
};

const SPEAKERS = Object.assign({}, ...Object.keys(CHARS).map(k => ({ [k]: { name: CHARS[k].name, voice: CHARS[k].voice } })), ...Object.keys(BOSSES).map(k => ({ [k]: { name: BOSSES[k].name, voice: 0.8, boss: 1 } })));
SPEAKERS.akaza.voice = 0.9; SPEAKERS.daki.voice = 1.5; SPEAKERS.susamaru.voice = 1.6; SPEAKERS.rui.voice = 1.3; SPEAKERS.doma.voice = 1.1;
SPEAKERS.muzan.voice = 0.7; SPEAKERS.kokushibo.voice = 0.5; SPEAKERS.temoni.voice = 0.5; SPEAKERS.gyokko.voice = 1.3; SPEAKERS.hantengu.voice = 1.2; SPEAKERS.hantengu.name = '半天狗';
SPEAKERS.tamayo = { name: ALLIES.tamayo.name, voice: ALLIES.tamayo.voice };
SPEAKERS.daki_solo.voice = 1.5; SPEAKERS.spider_mother.voice = 1.4; SPEAKERS.spider_father.voice = 0.3; SPEAKERS.enmu_roof.voice = SPEAKERS.enmu.voice; SPEAKERS.yahaba.voice = 0.9; SPEAKERS.shitaoni.voice = 0.6;
SPEAKERS.sekido.voice = 0.6; SPEAKERS.karaku.voice = 1.0; SPEAKERS.urogi.voice = 1.5; SPEAKERS.aizetsu.voice = 0.8;
