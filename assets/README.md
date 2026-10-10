# assets/ — ảnh tùy chọn (không bắt buộc)

Game tự vẽ toàn bộ nhân vật bằng code. Nếu bạn bỏ ảnh PNG (nền trong suốt) vào đây với **đúng tên file**, game sẽ tự dùng ảnh đó thay cho bản vẽ code. Thiếu file nào thì phần đó vẫn dùng bản vẽ code.

## 1. Chân dung — `assets/portraits/<key>.png`
Dùng ở khung hội thoại, HUD, đội hình, chọn ải. Ảnh vuông, mặt ở giữa, ~256×256.

## 2. Cut-in — `assets/cutin/<key>.png`
Hiện khi tung tuyệt chiêu (thức có cut-in). Ảnh ngang, cận cảnh đôi mắt/nửa mặt, cao ~300px, rộng ~800–1280px.

## 3. Sprite chiến đấu — `assets/sprites/<key>_<pose>.png`
Ảnh toàn thân **nhìn sang phải**, chân chạm đáy ảnh. Game tự lật khi quay trái và tự co về chiều cao nhân vật.

| pose | khi nào dùng |
|---|---|
| `idle` | đứng yên (bắt buộc nếu muốn dùng sprite) |
| `run` | chạy |
| `jump` | trên không |
| `attack` | đang chém / tung chiêu |
| `hurt` | bị trúng đòn |

Ví dụ: `assets/sprites/tanjiro_idle.png`, `assets/sprites/tanjiro_attack.png`.

## Danh sách key
Nhân vật: `tanjiro nezuko zenitsu inosuke kanao giyu rengoku shinobu tengen mitsuri muichiro obanai sanemi gyomei`

Quỷ: `temoni susamaru kyogai rui enmu akaza akaza2 daki gyutaro gyokko hantengu doma kokushibo muzan`

> **Chạy ở máy (mở index.html trực tiếp):** thêm tên file vào `assets/manifest.js`, ví dụ
> `window.ASSET_FILES = ['portraits/tanjiro.png', 'sprites/tanjiro_idle.png'];`
> Khi push lên GitHub, file này được tự tạo lại nên không cần sửa tay.

> Muốn tắt ảnh để xem bản vẽ code: mở `index.html?noassets`.
