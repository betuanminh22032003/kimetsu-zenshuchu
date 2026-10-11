# Thanh Gươm Diệt Quỷ — Chương Toàn Tập Trung (鬼滅の刃 — 全集中の章)

Fan game hành động 3D chạy thẳng trên trình duyệt, đi theo 13 màn của anime Kimetsu no Yaiba, từ Tuyển Chọn Cuối Cùng tới trận cuối với Kibutsuji Muzan. Phi thương mại, làm để chơi cho vui.

- ▶ **Chơi ngay:** https://betuanminh22032003.github.io/kimetsu-zenshuchu/
- 📊 **Chỉ số nhân vật & quỷ:** https://betuanminh22032003.github.io/kimetsu-zenshuchu/stats.html
- Phiên bản hiện tại: **v1.0.0** — xem [CHANGELOG.md](CHANGELOG.md)

Chơi offline: tải repo về, mở `index.html` bằng Chrome hoặc Edge (không cần cài gì). Nên chơi trên máy tính có bàn phím, chuột hoặc tay cầm.

## Có gì trong game
- **13 màn theo cốt truyện**, mỗi màn có thoại mở đầu / kết thúc và các chặng quỷ nhỏ trước trùm. Một số màn có luật riêng đúng như phim: cầm cự tới bình minh với Akaza và Muzan, chém cổ Daki và Gyutaro cùng lúc, tìm bản thể nhỏ của Hantengu…
- **14 thợ săn quỷ** với hơn 100 thức đúng nguyên tác (Thủy, Hinokami Kagura, Sấm, Thú, Lửa, Côn Trùng, Tình Yêu, Sương, Âm, Rắn, Gió, Đá, Hoa, Huyết quỷ thuật). Mỗi người có chỉ số và điểm mạnh / yếu riêng theo phim.
- **Giao diện tiếng Việt**, tiếng Nhật đi kèm dạng chữ nhỏ. Thoại có giọng đọc tiếng Nhật (Web Speech).
- **Đồ họa 3D dựng bằng code**: nhân vật chibi kiểu Nendoroid, map 3D cho từng màn, vệt chém shader, rồng / hổ lửa 3D, camera điện ảnh, bloom. Tự hạ chất lượng nếu máy yếu.
- Chế độ **Luyện tập**, màn **Danh sách chiêu thức** (cách dùng từng thức), **Hướng dẫn chơi** và trang **Chỉ số nhân vật**.

## Điều khiển
| Phím | Tác dụng |
|---|---|
| W A S D | Di chuyển 8 hướng |
| Space | Nhảy |
| Shift | Lướt né theo hướng đang đi (bất tử ngắn; né sát lúc trúng đòn = né hoàn hảo) |
| J / chuột trái | Chém — giữ để tự ra combo |
| 1 … 0, - = [ ] | Tung thẳng thức số đó |
| K / chuột phải | Tung thức đang chọn (chọn bằng Q / E / lăn chuột) |
| Giữ F | Bảng chọn thức (thời gian dừng lại) |
| G | Chém bật: đánh bật đạn của quỷ, hoặc gạt đòn cận chiến |
| R | Đổi bộ hơi thở (Tanjiro: Nước ↔ Hinokami) |
| Giữ L | Toàn tập trung — hồi hơi nhanh |
| Tab / C | Đổi nhân vật trong đội |
| Esc | Tạm dừng (H: hướng dẫn · M: thoát) |

Tay cầm (chuẩn Xbox): cần trái đi · A nhảy · X chém · Y tung thức · B lướt · LB / RB chọn thức · LT bảng thức · RT tụ khí · L3 / R3 chém bật · Back đổi người · Start tạm dừng.

## 13 màn
1. Tuyển Chọn Cuối Cùng — Quỷ Tay
2. Asakusa — Yahaba → Susamaru (có Tamayo hỗ trợ)
3. Dinh Thự Trống — Quỷ Lưỡi → Kyogai
4. Núi Natagumo — Mẹ Nhện → Cha Nhện → Rui
5. Chuyến Tàu Vô Tận — Enmu
6. Thượng Huyền Tam — Akaza (cầm cự tới bình minh)
7. Phố Đèn Đỏ — Daki → Daki & Gyutaro (chém cả hai trong 4 giây)
8. Làng Rèn Kiếm — cá vàng → Gyokko
9. Làng Rèn Kiếm — Sekido & Karaku → Urogi & Aizetsu → Zohakuten (chém bản thể nhỏ)
10. Vô Hạn Thành — Douma
11. Vô Hạn Thành — Akaza tái đấu
12. Vô Hạn Thành — Kokushibo
13. Trận cuối — Kibutsuji Muzan (cầm cự tới bình minh)

## Giọng Nhật
Thoại và tên chiêu được đọc bằng Web Speech (ja-JP), cần có giọng tiếng Nhật trên máy: Windows Settings → Time & Language → Language → thêm 日本語 (kèm Speech). Edge có sẵn giọng "Nanami Online" nghe tự nhiên nhất. Chỉnh mức đọc trong Cài đặt: Tắt / Vừa / Đầy đủ.

## Tùy chọn nâng cao
- Mô hình **VRM** riêng (vd. tự dựng bằng VRoid Studio), ảnh chân dung và ảnh cut-in vẽ tay: xem [assets/README.md](assets/README.md). Game ưu tiên dùng các file này nếu có.
- `?no3d` để chơi bản 2D cổ điển, `?2dchars` để xem nhân vật 2D trong map 3D.
- Nhạc riêng: Cài đặt → chọn file nhạc trên máy (chỉ lưu trong trình duyệt, không tải lên đâu).

## Cấu trúc mã
`js/data.js` (nhân vật, thức, quỷ, màn, bản dịch) · `js/game.js` (luật chơi) · `js/ui.js` + `js/guide.js` (giao diện canvas) · `js/render3d.js`, `js/world3d.js`, `js/model3d.js` (đồ họa 3D) · `js/portrait3d.js` (chân dung 3D cho giao diện) · `stats.html` (trang chỉ số, đọc thẳng từ `js/data.js`). Deploy tự động lên GitHub Pages khi push lên `main`.

---
Kimetsu no Yaiba © Koyoharu Gotouge / Shueisha, ufotable. Đây là fan game phi thương mại, không liên quan tới chủ sở hữu bản quyền.
