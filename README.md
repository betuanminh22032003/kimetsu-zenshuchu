# 鬼滅の刃 — 全集中の章 (fan game, dùng cá nhân)

Mở `index.html` bằng Chrome/Edge (double-click là chạy, không cần cài gì).

Giao diện song ngữ 日本語 / Tiếng Việt. Font thư pháp (Yuji Syuku, Shippori Mincho, Be Vietnam Pro) tải từ Google Fonts khi có mạng; offline thì dùng font có sẵn của Windows.

## Đồ họa 3D — đấu trường 3D thật
- **Đấu trường 3D, di chuyển 8 hướng**: W/A/S/D đi mọi hướng trên mặt đất, quỷ đuổi theo cả chiều sâu; đòn chém tự xoay & áp sát quỷ gần nhất, né vạch chém bằng cách bước sang ngang hoặc lướt (Shift) theo hướng đang đi.
- **Camera 3D điện ảnh**: góc cao bám theo trận đấu, tự kéo gần/xa theo khoảng cách hai bên (cả ngang lẫn sâu), xoay vòng khi tung tuyệt chiêu, quay quanh quỷ khi kết liễu. Hậu kỳ: bloom, khử răng cưa FXAA, chỉnh màu điện ảnh, vignette, film grain, bóng đổ mềm.
- **Map 3D hoàn toàn** (không còn ảnh nền 2D): bầu trời shader có sao lấp lánh, dải ngân hà, trăng có quầng, mây trôi, bình minh thật (ải Akaza / Muzan); địa hình đồi núi xa có sương phủ; rừng thông, cedar, cây tử đằng rủ hoa, cỏ lay theo gió, dương xỉ, đá; sương mù chuyển động, đom đóm, cánh hoa / tuyết / tro / tàn lửa rơi; suối nước nóng có mặt nước phản chiếu; nhà gỗ – mái ngói – mái tranh, nhà gạch phố Taisho, tháp Ryounkaku, đèn khí, cột điện dây võng, lồng đèn giấy; tàu Vô Hạn lao trong đêm (cây, cột điện vụt qua, khói đầu máy), đoàn tàu trật bánh, Vô Hạn Thành nhiều tầng lộn ngược, phòng băng của Douma.
- Chiêu thức 3D: vệt chém có sóng nước / lửa / sét bằng shader, **rồng 3D** (生生流転, 日暈の龍, 火雷神, rắn), **hổ lửa** 炎虎, hạt hiệu ứng GPU; đạn, vùng đòn và vạch cảnh báo của quỷ đều là vật thể 3D — mỗi con quỷ có huyết thuật riêng: tơ thép của Rui, đai lụa của Daki, xúc tu gai của Muzan, trăng khuyết của Kokushibo, gai băng & hoa sen băng của Douma, rồng gỗ & sét của Hantengu, cầu nước của Gyokko, bão liềm máu của Gyutaro, sóng xung kích của Akaza; khi quỷ gồng chiêu, ấn chú huyết quỷ thuật hiện dưới chân.
- **Toàn bộ nhân vật & quỷ là 3D**, dựng bằng code (kiểu figure Nendoroid: toon shading, viền mực, mặt anime có biểu cảm), quay mặt theo hướng chạy / hướng địch. Không tải file model nào — 0 KB.
- `?2dchars` để xem lại nhân vật 2D. Có model **VRM** riêng thì game ưu tiên dùng (xem [assets/README.md](assets/README.md)); thư viện VRM chỉ tải khi có file .vrm, asset nặng được phục vụ qua CDN jsDelivr.
- Tự hạ chất lượng (tắt bóng → tắt bloom/cỏ/sương) nếu máy chạy chậm. `?no3d` để về bản 2D cổ điển (đi trái/phải).

## Điều khiển
| Phím | Tác dụng |
|---|---|
| W A S D | Di chuyển 8 hướng (W/S: vào sâu / ra gần) |
| Space | Nhảy |
| Shift | Lướt né theo hướng đang đi (bất tử ngắn) |
| J | Chém thường (combo 3) |
| K | Tung thức đang chọn |
| Q / E / lăn chuột | Chọn thức |
| R | Đổi hơi thở (Tanjiro: 水の呼吸 ↔ ヒノカミ神楽) |
| Giữ L | 全集中 — hồi thanh 呼吸 nhanh |
| G | 弾き — chém bật: đánh bật đạn của quỷ ngược lại vào quỷ, hoặc gạt đòn cận chiến |
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
