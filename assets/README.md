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


## 4. Nhân vật 3D — `assets/vrm/<key>.vrm` (đẹp như anime nhất)

Game có engine 3D (Three.js + toon shader + bloom). Khi có file **VRM** của một nhân vật, game sẽ dùng model 3D đó thay cho hình 2D: tự đứng, chạy, nhảy, vung kiếm, lộn vòng, đổi biểu cảm (giận khi hô chiêu, nhắm mắt khi bị đánh).

**Cách có file VRM (miễn phí):**
1. Tải **VRoid Studio** (vroid.com/studio) — phần mềm nặn nhân vật anime 3D, kéo thả là ra.
2. Nặn nhân vật: kiểu tóc, màu mắt, áo haori (vẽ hoa văn caro / tam giác… vào texture áo).
3. **Export → VRM** (VRM 0.x hoặc 1.0 đều được), đặt tên theo key, ví dụ `assets/vrm/tanjiro.vrm`.
4. Push lên GitHub → game tự nhận (manifest được tạo lại khi deploy).
   Chạy ở máy thì thêm `'vrm/tanjiro.vrm'` vào `assets/manifest.js`.

Cũng có thể dùng model trên **VRoid Hub** nếu tác giả cho phép tải và dùng (xem điều khoản từng model).
Kiếm do game tự gắn vào tay phải, màu lưỡi theo nhân vật. Boss cũng nhận VRM theo key (ví dụ `muzan.vrm`).

> Mở `index.html?no3d` để chạy chế độ 2D cũ (máy yếu / không có WebGL).

> **Chạy ở máy (mở index.html trực tiếp):** thêm tên file vào `assets/manifest.js`, ví dụ
> `window.ASSET_FILES = ['portraits/tanjiro.png', 'sprites/tanjiro_idle.png'];`
> Khi push lên GitHub, file này được tự tạo lại nên không cần sửa tay.

> Muốn tắt ảnh để xem bản vẽ code: mở `index.html?noassets`.
