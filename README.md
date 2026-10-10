# 鬼滅の刃 — 全集中の章 (fan game, dùng cá nhân)

Mở `index.html` bằng Chrome/Edge (double-click là chạy, không cần cài gì).

Giao diện song ngữ 日本語 / Tiếng Việt. Font thư pháp (Yuji Syuku, Shippori Mincho, Be Vietnam Pro) tải từ Google Fonts khi có mạng; offline thì dùng font có sẵn của Windows.

## Đồ họa 3D
- Thế giới 3D (Three.js r147, WebGL): bối cảnh 3D từng ải (rừng tử đằng, phố Asakusa, dinh thự trống, núi nhện, tàu Vô Hạn, phố đèn đỏ, làng rèn, **Vô Hạn Thành với phòng shoji trôi lơ lửng**, Tokyo), ánh sáng, sương mù, đèn lóe theo chiêu, bloom phát sáng.
- Chiêu thức 3D: vệt chém có sóng nước / lửa / sét bằng shader, **rồng 3D** (生生流転, 日暈の龍, 火雷神, rắn), **hổ lửa** 炎虎, hạt hiệu ứng GPU.
- **Toàn bộ nhân vật & quỷ là 3D**, dựng bằng code (kiểu figure Nendoroid: toon shading, viền mực, mặt anime có biểu cảm): 14 kiếm sĩ với tóc/haori/kiếm riêng (haori caro Tanjiro, tam giác Zenitsu, nửa-nửa Giyu, lửa Rengoku, bướm Shinobu, đầu heo Inosuke, ống tre Nezuko, bím tóc Mitsuri, rìu-chùy Gyomei, roi kiếm, dao phay đôi…) và mọi con quỷ (xúc tu Muzan, dải obi Daki, quạt Doma, liềm máu Gyutaro, kiếm thịt Kokushibo 6 mắt, tay quỷ, bình Gyokko, trống Kyogai/Hantengu…). Không tải file model nào — 0 KB.
- Đạn & đòn của quỷ (quả cầu, nắm đấm khí, trăng khuyết, băng, lưới tơ, cột trăng…) và bóng mờ khi lướt cũng là 3D; lớp 2D chỉ còn HUD, chữ và vạch cảnh báo.
- `?2dchars` để xem lại nhân vật 2D. Có model **VRM** riêng thì game ưu tiên dùng (xem [assets/README.md](assets/README.md)); thư viện VRM chỉ tải khi có file .vrm, asset nặng được phục vụ qua CDN jsDelivr.
- Tự hạ chất lượng (tắt bóng → tắt bloom) nếu máy chạy chậm. `?no3d` để về bản 2D.

## Điều khiển
| Phím | Tác dụng |
|---|---|
| A / D | Di chuyển |
| W / Space | Nhảy |
| Shift | Lướt né (bất tử ngắn) |
| J | Chém thường (combo 3) |
| K | Tung thức đang chọn |
| Q / E / lăn chuột | Chọn thức |
| R | Đổi hơi thở (Tanjiro: 水の呼吸 ↔ ヒノカミ神楽) |
| Giữ L | 全集中 — hồi thanh 呼吸 nhanh |
| 1…0 / Tab | Đổi nhân vật trong đội |
| Esc | Tạm dừng (M: về chọn ải) |

## 13 ải theo anime
最終選別 (手鬼) → 浅草 (朱紗丸) → 鼓屋敷 (響凱) → 那田蜘蛛山 (累) → 無限列車 (魘夢) → 猗窩座 (cầm cự tới bình minh)
→ 遊郭 (堕姫 & 妓夫太郎 — phải chém cả hai trong 4s) → 刀鍛冶の里 (玉壺) → (半天狗 — chém bản thể nhỏ 「恨」)
→ 無限城: 童磨 → 猗窩座 tái đấu → 黒死牟 → **最終決戦: 鬼舞辻無惨** (đánh tới bình minh, 拾参ノ型 đẩy nhanh thanh 夜明け).

## Thức (theo Kimetsu no Yaiba Wiki, chỉ chiêu gốc manga/anime)
- 炭治郎: 水の呼吸 壱〜拾ノ型 (10) + ヒノカミ神楽 12 thức + 拾参ノ型 + 円舞一閃
- 冨岡義勇: 水の呼吸 壱〜拾壱ノ型 (11, gồm 凪)
- 善逸: 霹靂一閃 (+六連 / 八連 / 神速) + 漆ノ型 火雷神
- 伊之助: 獣の呼吸 11 nanh/thức · 煉獄: 炎の呼吸 6 (壱〜伍, 玖) · しのぶ: 蟲の呼吸 5
- 蜜璃: 恋の呼吸 5 (壱弐参伍陸) · 無一郎: 霞の呼吸 7 · 天元: 音の呼吸 3 (壱肆伍)
- 伊黒: 蛇の呼吸 5 · 実弥: 風の呼吸 9 · 悲鳴嶼: 岩の呼吸 5 · カナヲ: 花の呼吸 5 (弐肆伍陸終) · 禰豆子: 血鬼術 爆血

Trong game có màn **技一覧** liệt kê đầy đủ.

## Giọng Nhật
Thoại và tên chiêu được đọc bằng Web Speech (ja-JP). Cần có giọng tiếng Nhật trên máy:
Windows Settings → Time & Language → Language → thêm 日本語 (kèm Speech). Edge có sẵn giọng "Nanami Online" nghe tự nhiên nhất.
